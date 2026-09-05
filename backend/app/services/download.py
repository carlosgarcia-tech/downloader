import logging
from collections.abc import Callable

import yt_dlp

from app.config import settings
from app.models.job import DownloadMode, Job, JobStatus

logger = logging.getLogger(__name__)


class DownloadError(Exception):
    pass


def make_progress_hook(job_id: str, update_callback: Callable[[Job], None]):
    def hook(d: dict):
        job = None
        try:
            status = d.get("status")
            info = d.get("info_dict") or {}

            if status == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                downloaded = d.get("downloaded_bytes", 0)
                pct = round((downloaded / total) * 100, 1) if total else 0

                job = Job(
                    id=job_id,
                    url=d.get("url", ""),
                    mode=DownloadMode.AUDIO,
                    status=JobStatus.DOWNLOADING,
                    progress=pct,
                    speed=d.get("speed"),
                    eta=d.get("eta"),
                    current_title=info.get("title", ""),
                    item_index=info.get("playlist_index"),
                    item_count=info.get("n_entries") or info.get("playlist_count"),
                )
            elif status == "finished":
                job = Job(
                    id=job_id,
                    url=d.get("url", ""),
                    mode=DownloadMode.AUDIO,
                    status=JobStatus.PROCESSING,
                    progress=100.0,
                )
            elif status == "error":
                job = Job(
                    id=job_id,
                    url=d.get("url", ""),
                    mode=DownloadMode.AUDIO,
                    status=JobStatus.ERROR,
                    error=str(d.get("error", "Error desconocido"))[:500],
                )

            if job:
                update_callback(job)

        except Exception as e:
            logger.error("Error in progress hook: %s", e)

    return hook


def build_ydl_opts(job: Job, update_callback: Callable[[Job], None]) -> dict:
    folder = (job.folder or "").strip()
    output_dir = settings.downloads_dir / folder if folder else settings.downloads_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    common = {
        "windowsfilenames": True,
        "restrictfilenames": False,
        "noprogress": True,
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": "only_download",
        "progress_hooks": [make_progress_hook(job.id, update_callback)],
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


def download_worker(job: Job, update_callback: Callable[[Job], None]) -> Job:
    try:
        job.status = JobStatus.STARTING
        update_callback(job)

        ydl_opts = build_ydl_opts(job, update_callback)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([str(job.url)])

        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
        else:
            job.status = JobStatus.COMPLETED
            job.progress = 100.0
            job.speed = None
            job.eta = None

    except yt_dlp.utils.DownloadError as e:
        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
        else:
            job.status = JobStatus.ERROR
            job.error = str(e)[:500]
        logger.error("Download error for job %s: %s", job.id, e)
    except Exception as e:
        if job.cancel_requested:
            job.status = JobStatus.CANCELLED
        else:
            job.status = JobStatus.ERROR
            job.error = str(e)[:500]
        logger.exception("Unexpected error for job %s", job.id)

    update_callback(job)
    return job
