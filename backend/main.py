"""
Descargador — Backend FastAPI + yt-dlp (Modular Architecture)
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import broadcast_loop, router, set_executor, ws_endpoint
from app.config import settings
from app.core.logging import get_logger, setup_logging
from app.core.security import RateLimitMiddleware
from app.services.ffmpeg import FFmpegNotFoundError, verify_ffmpeg
from app.services.job_queue import job_queue

logger = get_logger(__name__)

executor = ThreadPoolExecutor(max_workers=settings.max_concurrent_downloads)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting Descargador backend...")

    try:
        verify_ffmpeg()
    except FFmpegNotFoundError as e:
        logger.error("FFmpeg verification failed: %s", e)
        raise

    await job_queue.init()
    set_executor(executor)

    broadcast_task = asyncio.create_task(broadcast_loop())
    logger.info("Descargador backend started on %s:%d", settings.host, settings.port)

    yield

    broadcast_task.cancel()
    try:
        await broadcast_task
    except asyncio.CancelledError:
        pass

    executor.shutdown(wait=True)
    await job_queue.close()
    logger.info("Descargador backend stopped")


app = FastAPI(
    title="Descargador",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

app.include_router(router)

app.websocket("/ws")(ws_endpoint)

app.mount(
    "/",
    StaticFiles(directory=str(settings.frontend_dir), html=True),
    name="frontend",
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )
