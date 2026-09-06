import logging
import os
import threading
import time
import traceback
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

import yt_dlp

from app.config import settings
from app.models.job import DownloadMode, Job, JobStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global semaphore — shared across ALL download paths (single tracks +
# playlist items).  This is the real concurrent-download limit.
# The job executor (main.py) has max_workers = same value, but that only
# controls how many jobs enter "starting" state — it does NOT guarantee
# that ydl.download() runs in parallel.  A job can hold an executor slot
# while waiting on this semaphore or while postprocessors run.
# ---------------------------------------------------------------------------
_global_semaphore = threading.Semaphore(settings.max_concurrent_downloads)

# ---------------------------------------------------------------------------
# Item-level thread pool (separate from the job executor)
# The pool is large enough to not starve while threads wait on the semaphore.
# ---------------------------------------------------------------------------
item_executor = ThreadPoolExecutor(max_workers=32, thread_name_prefix="dl-item")

# ---------------------------------------------------------------------------
# In-memory progress tracking for active playlist jobs
# ---------------------------------------------------------------------------
_active_jobs_lock = threading.Lock()
_active_jobs: dict[str, "_JobProgress"] = {}


@dataclass
class _ItemState:
    index: int
    progress: float = 0.0
    speed: float = 0.0
    eta: int | None = None
    title: str = ""
    status: str = "downloading"  # downloading | completed | error


@dataclass
class _JobProgress:
    lock: threading.Lock = field(default_factory=threading.Lock)
    item_count: int = 0
    items: dict[int, _ItemState] = field(default_factory=dict)
    output_files: list[str] = field(default_factory=list)
    failed_items: list[dict] = field(default_factory=list)
    done_event: threading.Event = field(default_factory=threading.Event)


# ---------------------------------------------------------------------------
# Consolidator — runs in a daemon thread, writes aggregated progress to DB
# every 0.5s.  This is the ONLY writer of playlist progress to SQLite.
# ---------------------------------------------------------------------------
_consolidator_running = False


def _start_consolidator():
    """Start the consolidator thread if not already running."""
    global _consolidator_running
    if _consolidator_running:
        return
    _consolidator_running = True
    t = threading.Thread(target=_consolidator_loop, daemon=True, name="consolidator")
    t.start()
    logger.info("Consolidator thread started")


def _consolidator_loop():
    from app.services.job_queue import job_queue  # import here to avoid circular

    while True:
        try:
            time.sleep(0.5)
            with _active_jobs_lock:
                snapshot = list(_active_jobs.items())

            for job_id, jp in snapshot:
                _consolidate_job(job_id, jp, job_queue)

        except Exception as e:
            logger.error("Consolidator error: %s", e)
            logger.debug(traceback.format_exc())


def _consolidate_job(job_id: str, jp: _JobProgress, job_queue):
    """Aggregate progress from in-memory dict and write to SQLite."""
    with jp.lock:
        if jp.item_count == 0:
            return

        total_progress = 0.0
        total_speed = 0.0
        active_speed_count = 0
        completed = 0
        errored = 0

        for item in jp.items.values():
            total_progress += item.progress
            if item.status == "completed":
                completed += 1
            elif item.status == "error":
                errored += 1
            elif item.speed and item.speed > 0:
                total_speed += item.speed
                active_speed_count += 1

        pct = round(total_progress / jp.item_count, 1) if jp.item_count else 0
        avg_speed = total_speed / active_speed_count if active_speed_count > 0 else None
        items_done = completed + errored
        remaining = jp.item_count - items_done
        status_label = f"Descargando {items_done + 1} de {jp.item_count}" if remaining > 0 else "Procesando"

        # Build output_files copy
        output_files = list(jp.output_files)
        failed_items = list(jp.failed_items)

    # Write to DB via the sync wrapper (uses main event loop)
    try:
        job = Job(
            id=job_id,
            url="",
            mode=DownloadMode.AUDIO,
            status=JobStatus.DOWNLOADING,
            progress=pct,
            speed=avg_speed,
            current_title=status_label,
            item_index=items_done,
            item_count=jp.item_count,
            output_files=output_files or None,
            failed_items=failed_items or None,
        )
        job_queue.update_sync(job)
    except Exception as e:
        logger.error("[job=%s] Consolidator DB write failed: %s", job_id, e)


# ---------------------------------------------------------------------------
# Item download — runs in item_executor, acquires global semaphore
# ---------------------------------------------------------------------------
def _download_item(
    job: Job,
    item_index: int,
    url: str,
    jp: _JobProgress,
    update_callback: Callable[[Job], None],
):
    """Download a single item from a playlist.  Runs in item_executor pool."""
    from app.services.job_queue import job_queue as jq  # local import

    item_state = _ItemState(index=item_index)
    with jp.lock:
        jp.items[item_index] = item_state

    _global_semaphore.acquire()
    try:
        if job.cancel_requested:
            item_state.status = "error"
            with jp.lock:
                jp.failed_items.append({"index": item_index, "error": "Cancelled"})
            logger.info("[job=%s][item=%d] Cancelled before start", job.id, item_index)
            return

        logger.info("[job=%s][item=%d] Starting download — url=%s", job.id, item_index, url[:80])

        # Build yt-dlp options for this individual item
        folder = (job.folder or "").strip()
        output_dir = settings.downloads_dir / folder if folder else settings.downloads_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        def _item_progress_hook(d: dict):
            try:
                status = d.get("status")
                info = d.get("info_dict") or {}

                if status == "downloading":
                    total = d.get("total_bytes") or d.get("total_bytes_estimate")
                    downloaded = d.get("downloaded_bytes", 0)
                    pct = round((downloaded / total) * 100, 1) if total else 0

                    with jp.lock:
                        item_state.progress = pct
                        item_state.speed = d.get("speed") or 0
                        item_state.eta = d.get("eta")
                        t = info.get("title", "")
                        if t:
                            item_state.title = t

                elif status == "error":
                    error_msg = str(d.get("error", "Error desconocido"))
                    logger.error("[job=%s][item=%d] yt-dlp error: %s", job.id, item_index, error_msg[:200])
                    with jp.lock:
                        item_state.status = "error"
                        item_state.progress = 0
                        jp.failed_items.append({
                            "index": item_index,
                            "title": item_state.title,
                            "error": error_msg[:500],
                        })

            except Exception as e:
                logger.error("[job=%s][item=%d] Progress hook error: %s", job.id, item_index, e)

        def _item_postprocessor_hook(d: dict):
            try:
                if d.get("status") == "finished":
                    filepath = d.get("filepath") or (d.get("info_dict") or {}).get("filepath")
                    if filepath:
                        abs_path = os.path.abspath(filepath)
                        info = d.get("info_dict") or {}
                        title = info.get("title", item_state.title)

                        with jp.lock:
                            jp.output_files.append(abs_path)
                            item_state.status = "completed"
                            item_state.progress = 100.0
                            item_state.title = title

                        logger.info(
                            "[job=%s][item=%d] Completed: %s",
                            job.id, item_index, abs_path,
                        )

            except Exception as e:
                logger.error("[job=%s][item=%d] Postprocessor hook error: %s", job.id, item_index, e)

        ydl_opts = {
            "windowsfilenames": True,
            "restrictfilenames": False,
            "noprogress": True,
            "quiet": True,
            "no_warnings": True,
            "ignoreerrors": "only_download",
            "progress_hooks": [_item_progress_hook],
            "postprocessor_hooks": [_item_postprocessor_hook],
            "writethumbnail": True,
        }

        if job.mode == DownloadMode.AUDIO:
            codec = job.audio_format.value
            quality = job.audio_quality
            outtmpl = str(
                output_dir
                / "%(artist,uploader|Desconocido)s"
                / "%(album,playlist_title|Sencillos)s"
                / "%(track,title)s.%(ext)s"
            )
            ydl_opts.update(
                format="bestaudio/best",
                outtmpl=outtmpl,
                postprocessors=[
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": codec,
                        "preferredquality": quality if codec == "mp3" else "0",
                    },
                    {"key": "FFmpegMetadata", "add_metadata": True},
                    {"key": "EmbedThumbnail"},
                ],
            )
        else:
            quality = job.video_quality.value
            height_filter = "" if quality == "best" else f"[height<={quality}]"
            outtmpl = str(output_dir / "%(playlist_title|Videos)s" / "%(title)s.%(ext)s")
            ydl_opts.update(
                format=f"bestvideo{height_filter}+bestaudio/best{height_filter}",
                merge_output_format="mp4",
                outtmpl=outtmpl,
                postprocessors=[{"key": "FFmpegMetadata", "add_metadata": True}],
            )

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # If item_state wasn't set to completed by the postprocessor hook
        # (e.g. no postprocessor ran), mark it completed manually
        with jp.lock:
            if item_state.status == "downloading":
                item_state.status = "completed"
                item_state.progress = 100.0

    except yt_dlp.utils.DownloadError as e:
        logger.error("[job=%s][item=%d] DownloadError: %s", job.id, item_index, str(e)[:300])
        with jp.lock:
            item_state.status = "error"
            jp.failed_items.append({
                "index": item_index,
                "title": item_state.title,
                "error": str(e)[:500],
            })
    except Exception as e:
        logger.exception("[job=%s][item=%d] Unexpected error", job.id, item_index)
        with jp.lock:
            item_state.status = "error"
            jp.failed_items.append({
                "index": item_index,
                "title": item_state.title,
                "error": str(e)[:500],
            })
    finally:
        _global_semaphore.release()
        jp.done_event.set()


# ---------------------------------------------------------------------------
# Build yt-dlp options for a single (non-playlist) download
# ---------------------------------------------------------------------------
def _build_single_ydl_opts(job: Job, update_callback: Callable[[Job], None]) -> dict:
    folder = (job.folder or "").strip()
    output_dir = settings.downloads_dir / folder if folder else settings.downloads_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("[job=%s] Building yt-dlp options: mode=%s output_dir=%s", job.id, job.mode.value, output_dir)

    def _progress_hook(d: dict):
        """Progress hook for single-track downloads — writes directly to DB."""
        job_ref = None
        try:
            status = d.get("status")
            info = d.get("info_dict") or {}

            if status == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                downloaded = d.get("downloaded_bytes", 0)
                pct = round((downloaded / total) * 100, 1) if total else 0

                job_ref = Job(
                    id=job.id,
                    url=d.get("url", ""),
                    mode=job.mode,
                    status=JobStatus.DOWNLOADING,
                    progress=pct,
                    speed=d.get("speed"),
                    eta=d.get("eta"),
                    current_title=info.get("title", ""),
                )
            elif status == "finished":
                job_ref = Job(
                    id=job.id,
                    url=d.get("url", ""),
                    mode=job.mode,
                    status=JobStatus.PROCESSING,
                    progress=100.0,
                )
            elif status == "error":
                error_msg = str(d.get("error", "Error desconocido"))
                logger.error("[job=%s] yt-dlp error: %s", job.id, error_msg[:200])
                job_ref = Job(
                    id=job.id,
                    url=d.get("url", ""),
                    mode=job.mode,
                    status=JobStatus.ERROR,
                    error=error_msg[:500],
                )

            if job_ref:
                update_callback(job_ref)

        except Exception as e:
            logger.error("[job=%s] Progress hook error: %s", job.id, e)
            logger.debug(traceback.format_exc())

    def _postprocessor_hook(d: dict):
        """Postprocessor hook for single-track — captures filepath."""
        try:
            if d.get("status") == "finished":
                filepath = d.get("filepath") or (d.get("info_dict") or {}).get("filepath")
                if filepath:
                    abs_path = os.path.abspath(filepath)
                    if job.output_files is None:
                        job.output_files = []
                    job.output_files.append(abs_path)
                    job.output_path = os.path.dirname(abs_path)

                    info = d.get("info_dict") or {}
                    if not job.current_title:
                        job.current_title = info.get("title", "")
                    if not job.playlist_title:
                        job.playlist_title = info.get("playlist_title") or info.get("playlist", "")

                    logger.info(
                        "[job=%s] Postprocessor captured file: %s (output_files=%d)",
                        job.id, abs_path, len(job.output_files),
                    )
                    update_callback(job)
        except Exception as e:
            logger.error("[job=%s] Postprocessor hook error: %s", job.id, e)
            logger.debug(traceback.format_exc())

    common = {
        "windowsfilenames": True,
        "restrictfilenames": False,
        "noprogress": True,
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": "only_download",
        "progress_hooks": [_progress_hook],
        "postprocessor_hooks": [_postprocessor_hook],
        "writethumbnail": True,
    }

    if job.mode == DownloadMode.AUDIO:
        codec = job.audio_format.value
        quality = job.audio_quality
        outtmpl = str(
            output_dir
            / "%(artist,uploader|Desconocido)s"
            / "%(album,playlist_title|Sencillos)s"
            / "%(track,title)s.%(ext)s"
        )
        common.update(
            format="bestaudio/best",
            outtmpl=outtmpl,
            postprocessors=[
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": codec,
                    "preferredquality": quality if codec == "mp3" else "0",
                },
                {"key": "FFmpegMetadata", "add_metadata": True},
                {"key": "EmbedThumbnail"},
            ],
        )
    else:
        quality = job.video_quality.value
        height_filter = "" if quality == "best" else f"[height<={quality}]"
        outtmpl = str(output_dir / "%(playlist_title|Videos)s" / "%(title)s.%(ext)s")
        common.update(
            format=f"bestvideo{height_filter}+bestaudio/best{height_filter}",
            merge_output_format="mp4",
            outtmpl=outtmpl,
            postprocessors=[{"key": "FFmpegMetadata", "add_metadata": True}],
        )

    return common


# ---------------------------------------------------------------------------
# Detect playlist
# ---------------------------------------------------------------------------
def _is_playlist_url(url: str) -> bool:
    """Check if URL is a YouTube playlist/album."""
    from urllib.parse import parse_qs, urlparse

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    return bool(qs.get("list"))


# ---------------------------------------------------------------------------
# Main download worker — entry point submitted to the job executor
# ---------------------------------------------------------------------------
def download_worker(job: Job, update_callback: Callable[[Job], None]) -> Job:
    logger.info("[job=%s] Worker started — url=%s mode=%s", job.id, job.url[:80], job.mode.value)

    try:
        job.status = JobStatus.STARTING
        update_callback(job)

        # --- Playlist path ---------------------------------------------------
        if _is_playlist_url(job.url):
            return _download_playlist(job, update_callback)

        # --- Single track path -----------------------------------------------
        return _download_single(job, update_callback)

    except Exception as e:
        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
            logger.info("[job=%s] Job cancelled (Exception)", job.id)
        else:
            job.status = JobStatus.ERROR
            job.error = str(e)[:500]
            logger.exception("[job=%s] Unexpected error in download worker", job.id)

    logger.info("[job=%s] Worker finished — status=%s", job.id, job.status.value)
    update_callback(job)
    return job


def _download_single(job: Job, update_callback: Callable[[Job], None]) -> Job:
    """Download a single track (no playlist parallelism)."""
    _global_semaphore.acquire()
    try:
        ydl_opts = _build_single_ydl_opts(job, update_callback)

        logger.info("[job=%s] Calling yt_dlp.YoutubeDL.download(%s)", job.id, job.url[:80])
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([str(job.url)])

        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
            logger.info("[job=%s] Job cancelled after download", job.id)
        else:
            job.status = JobStatus.COMPLETED
            job.progress = 100.0
            job.speed = None
            job.eta = None
            logger.info(
                "[job=%s] Job completed — files=%s playlist_title=%s",
                job.id, job.output_files, job.playlist_title,
            )

    except yt_dlp.utils.DownloadError as e:
        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
            logger.info("[job=%s] Job cancelled (DownloadError)", job.id)
        else:
            job.status = JobStatus.ERROR
            job.error = str(e)[:500]
            logger.error("[job=%s] DownloadError: %s", job.id, str(e)[:300])
    except Exception as e:
        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
            logger.info("[job=%s] Job cancelled (Exception)", job.id)
        else:
            job.status = JobStatus.ERROR
            job.error = str(e)[:500]
            logger.exception("[job=%s] Unexpected error in download worker", job.id)
    finally:
        _global_semaphore.release()

    logger.info("[job=%s] Worker finished — status=%s", job.id, job.status.value)
    update_callback(job)
    return job


def _download_playlist(job: Job, update_callback: Callable[[Job], None]) -> Job:
    """Download a playlist in parallel — extract first, then fan out items."""
    logger.info("[job=%s] Playlist detected — extracting entries from %s", job.id, job.url[:80])

    # --- Step 1: Extract playlist entries (flat, no download) ----------------
    extract_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "skip_download": True,
    }

    entries = []
    with yt_dlp.YoutubeDL(extract_opts) as ydl:
        info = ydl.extract_info(str(job.url), download=False)

    if info and "entries" in info:
        entries = list(info["entries"])

    if not entries:
        job.status = JobStatus.ERROR
        job.error = "No se encontraron entradas en la playlist"
        logger.error("[job=%s] No entries found in playlist", job.id)
        update_callback(job)
        return job

    item_count = len(entries)
    job.item_count = item_count
    if not job.playlist_title:
        job.playlist_title = info.get("title") or info.get("playlist_title") or ""
    job.status = JobStatus.DOWNLOADING
    update_callback(job)

    logger.info(
        "[job=%s] Playlist: %d items, title=%s",
        job.id, item_count, job.playlist_title,
    )

    # --- Step 2: Build item URLs ---------------------------------------------
    item_urls = []
    for i, entry in enumerate(entries):
        if entry.get("url"):
            item_urls.append((i, entry["url"]))
        elif entry.get("id"):
            item_urls.append((i, f"https://www.youtube.com/watch?v={entry['id']}"))
        else:
            logger.warning("[job=%s][item=%d] Entry has no URL/id, skipping: %s", job.id, i, entry)
            with _active_jobs_lock:
                pass  # will be added to failed below

    if not item_urls:
        job.status = JobStatus.ERROR
        job.error = "No se pudieron resolver las URLs de la playlist"
        logger.error("[job=%s] Could not resolve any item URLs", job.id)
        update_callback(job)
        return job

    # --- Step 3: Register progress tracker -----------------------------------
    jp = _JobProgress(item_count=item_count)
    for idx, _ in item_urls:
        jp.items[idx] = _ItemState(index=idx)

    with _active_jobs_lock:
        _active_jobs[job.id] = jp

    _start_consolidator()

    # --- Step 4: Launch item downloads in parallel ---------------------------
    futures = []
    for idx, url in item_urls:
        future = item_executor.submit(_download_item, job, idx, url, jp, update_callback)
        futures.append(future)

    # --- Step 5: Wait for all items to finish --------------------------------
    for future in futures:
        try:
            future.result(timeout=3600)  # 1h per item max
        except Exception as e:
            logger.error("[job=%s] Item future raised: %s", job.id, e)

    # --- Step 6: Consolidate final state -------------------------------------
    with jp.lock:
        output_files = list(jp.output_files)
        failed_items = list(jp.failed_items)

    job.output_files = output_files or None
    job.failed_items = failed_items or None
    job.output_path = os.path.dirname(output_files[0]) if output_files else None

    # Remove from active tracking
    with _active_jobs_lock:
        _active_jobs.pop(job.id, None)

    if job.cancel_requested:
        job.status = JobStatus.CANCELLED
        logger.info("[job=%s] Playlist cancelled", job.id)
    elif failed_items and not output_files:
        job.status = JobStatus.ERROR
        job.error = f"Todos los items fallaron ({len(failed_items)} errores)"
        logger.error("[job=%s] All %d items failed", job.id, len(failed_items))
    else:
        job.status = JobStatus.COMPLETED
        job.progress = 100.0
        job.speed = None
        job.eta = None
        if failed_items:
            logger.warning(
                "[job=%s] Playlist completed with %d failed items out of %d",
                job.id, len(failed_items), item_count,
            )
        else:
            logger.info(
                "[job=%s] Playlist completed — %d files, title=%s",
                job.id, len(output_files), job.playlist_title,
            )

    logger.info("[job=%s] Worker finished — status=%s", job.id, job.status.value)
    update_callback(job)
    return job
