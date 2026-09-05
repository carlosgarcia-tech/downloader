import logging

from fastapi import APIRouter, HTTPException

from app.core.security import validate_url
from app.models.job import Job, JobCreate
from app.services.download import download_worker
from app.services.job_queue import job_queue

logger = logging.getLogger(__name__)

router = APIRouter()

executor = None


def set_executor(exec_instance):
    global executor
    executor = exec_instance


@router.post("/api/jobs", response_model=dict)
async def create_jobs(req: JobCreate):
    urls = [u.strip() for u in req.urls.splitlines() if u.strip()]

    if not urls:
        raise HTTPException(status_code=400, detail="No se proporcionaron URLs válidas")

    for url in urls:
        if not validate_url(url):
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
        executor.submit(download_worker, job, job_queue.update)
        created.append(job.id)

    logger.info("Created %d jobs", len(created))
    return {"created": created}


@router.get("/api/jobs", response_model=list[Job])
async def list_jobs():
    return await job_queue.list_all()


@router.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str):
    success = await job_queue.cancel(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado o no cancelable")
    return {"ok": True}


@router.post("/api/jobs/clear")
async def clear_finished():
    count = await job_queue.clear_finished()
    return {"ok": True, "cleared": count}


@router.get("/api/health")
async def health_check():
    return {"status": "ok"}
