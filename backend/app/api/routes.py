import logging
import os
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from starlette.background import BackgroundTask

from app.config import settings
from app.core.security import validate_url
from app.models.job import Job, JobCreate, JobStatus
from app.services.download import download_worker
from app.services.job_queue import job_queue

logger = logging.getLogger(__name__)

router = APIRouter()

executor = None

DOWNLOADS_ROOT = settings.downloads_dir.resolve()


def set_executor(exec_instance):
    global executor
    executor = exec_instance


def safe_resolve(path_str: str) -> Path:
    resolved = Path(path_str).resolve()
    if not resolved.is_relative_to(DOWNLOADS_ROOT):
        logger.warning("Path traversal attempt blocked: %s", path_str)
        raise HTTPException(403, "Ruta fuera del directorio permitido")
    if not resolved.is_file():
        logger.warning("File not found on disk: %s", resolved)
        raise HTTPException(404, "Archivo no encontrado en disco")
    return resolved


async def get_job_or_404(job_id: str) -> Job:
    job = await job_queue.get(job_id)
    if not job:
        logger.warning("Job not found: %s", job_id)
        raise HTTPException(404, "Trabajo no encontrado")
    return job


@router.post("/api/jobs", response_model=dict)
async def create_jobs(req: JobCreate, request: Request):
    client = request.client.host if request.client else "unknown"
    logger.info("[%s] POST /api/jobs — mode=%s, urls=%d", client, req.mode.value, len(req.urls.splitlines()))

    urls = [u.strip() for u in req.urls.splitlines() if u.strip()]

    if not urls:
        logger.warning("[%s] No valid URLs provided", client)
        raise HTTPException(status_code=400, detail="No se proporcionaron URLs válidas")

    for url in urls:
        if not validate_url(url):
            logger.warning("[%s] Invalid URL rejected: %s", client, url)
            raise HTTPException(status_code=400, detail=f"URL no permitida: {url}")

    created = []
    for url in urls:
        job = Job(
            url=url,
            mode=req.mode,
            audio_format=req.audio_format,
            audio_quality=req.audio_quality,
            video_quality=req.video_quality,
            folder=req.folder,
        )
        await job_queue.create(job)
        logger.info("[%s] Job created: id=%s url=%s mode=%s", client, job.id, url[:80], req.mode.value)
        executor.submit(download_worker, job, job_queue.update_sync)
        created.append(job.id)

    logger.info("[%s] POST /api/jobs OK — created %d jobs: %s", client, len(created), created)
    return {"created": created}


@router.get("/api/jobs", response_model=list[Job])
async def list_jobs(request: Request):
    client = request.client.host if request.client else "unknown"
    jobs = await job_queue.list_all()
    logger.debug("[%s] GET /api/jobs — returned %d jobs", client, len(jobs))
    return jobs


@router.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str, request: Request):
    client = request.client.host if request.client else "unknown"
    logger.info("[%s] DELETE /api/jobs/%s", client, job_id)
    success = await job_queue.cancel(job_id)
    if not success:
        logger.warning("[%s] Cancel failed for job %s (not found or not cancelable)", client, job_id)
        raise HTTPException(status_code=404, detail="Trabajo no encontrado o no cancelable")
    logger.info("[%s] Job %s cancelled successfully", client, job_id)
    return {"ok": True}


@router.post("/api/jobs/clear")
async def clear_finished(request: Request):
    client = request.client.host if request.client else "unknown"
    logger.info("[%s] POST /api/jobs/clear", client)
    count = await job_queue.clear_finished()
    logger.info("[%s] Cleared %d finished jobs", client, count)
    return {"ok": True, "cleared": count}


@router.get("/api/jobs/{job_id}/download")
async def download_job(job_id: str, request: Request):
    client = request.client.host if request.client else "unknown"
    logger.info("[%s] GET /api/jobs/%s/download", client, job_id)
    job = await get_job_or_404(job_id)

    if job.status != JobStatus.COMPLETED:
        logger.warning("[%s] Job %s not completed (status=%s)", client, job_id, job.status.value)
        raise HTTPException(409, "El job todavía no terminó")

    if job.output_files is not None:
        logger.info("[%s] Job %s has %d files — redirecting to zip", client, job_id, len(job.output_files))
        return RedirectResponse(f"/api/jobs/{job_id}/download-zip")

    if not job.output_path:
        logger.warning("[%s] Job %s has no output_path", client, job_id)
        raise HTTPException(404, "No hay archivo de salida para este job")

    try:
        path = safe_resolve(job.output_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[%s] Error resolving path for job %s: %s", client, job_id, e)
        raise HTTPException(500, f"Error resolviendo ruta: {e}")

    logger.info("[%s] Serving file: %s", client, path)
    return FileResponse(
        path,
        filename=path.name,
        media_type="application/octet-stream",
    )


@router.get("/api/jobs/{job_id}/download-zip")
async def download_job_zip(job_id: str, request: Request):
    client = request.client.host if request.client else "unknown"
    logger.info("[%s] GET /api/jobs/%s/download-zip", client, job_id)
    job = await get_job_or_404(job_id)

    if job.status != JobStatus.COMPLETED:
        logger.warning("[%s] Job %s not completed (status=%s)", client, job_id, job.status.value)
        raise HTTPException(409, "El job todavía no terminó")

    if not job.output_files:
        logger.warning("[%s] Job %s has no output_files", client, job_id)
        raise HTTPException(404, "No hay archivos para este job")

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp.close()
    logger.info("[%s] Creating zip for job %s with %d files → %s", client, job_id, len(job.output_files), tmp.name)

    try:
        with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_str in job.output_files:
                path = safe_resolve(file_str)
                zf.write(path, arcname=path.name)
                logger.debug("[%s] Added to zip: %s", client, path.name)
    except Exception as e:
        os.unlink(tmp.name)
        logger.error("[%s] Error creating zip for job %s: %s", client, job_id, e)
        raise HTTPException(500, f"Error creando zip: {e}")

    zip_name = f"{job.playlist_title or job.id}.zip"
    logger.info("[%s] Zip ready: %s (%d files)", client, zip_name, len(job.output_files))

    return FileResponse(
        tmp.name,
        filename=zip_name,
        media_type="application/zip",
        background=BackgroundTask(os.unlink, tmp.name),
    )


@router.get("/api/health")
async def health_check():
    return {"status": "ok"}
