import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional, List
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Float, Integer, DateTime, Boolean, select, delete
from datetime import datetime
import uuid

from app.config import settings
from app.models.job import Job, JobStatus, DownloadMode, AudioFormat, VideoQuality

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class JobModel(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    url: Mapped[str] = mapped_column(String(2048))
    mode: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default=JobStatus.QUEUED)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eta: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_title: Mapped[str] = mapped_column(String(512), default="")
    item_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    item_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    audio_format: Mapped[str] = mapped_column(String(16), default=AudioFormat.MP3)
    audio_quality: Mapped[str] = mapped_column(String(16), default="320")
    video_quality: Mapped[str] = mapped_column(String(16), default=VideoQuality.BEST)
    folder: Mapped[str] = mapped_column(String(256), default="")

    def to_job(self) -> Job:
        return Job(
            id=self.id,
            url=self.url,
            mode=DownloadMode(self.mode),
            status=JobStatus(self.status),
            progress=self.progress,
            speed=self.speed,
            eta=self.eta,
            current_title=self.current_title,
            item_index=self.item_index,
            item_count=self.item_count,
            error=self.error,
            cancel_requested=self.cancel_requested,
            created_at=self.created_at,
            updated_at=self.updated_at,
            audio_format=AudioFormat(self.audio_format),
            audio_quality=self.audio_quality,
            video_quality=VideoQuality(self.video_quality),
            folder=self.folder,
        )

    @classmethod
    def from_job(cls, job: Job) -> "JobModel":
        return cls(
            id=job.id,
            url=str(job.url),
            mode=job.mode.value,
            status=job.status.value,
            progress=job.progress,
            speed=job.speed,
            eta=job.eta,
            current_title=job.current_title,
            item_index=job.item_index,
            item_count=job.item_count,
            error=job.error,
            cancel_requested=job.cancel_requested,
            created_at=job.created_at,
            updated_at=job.updated_at,
            audio_format=job.audio_format.value,
            audio_quality=job.audio_quality,
            video_quality=job.video_quality.value,
            folder=job.folder,
        )


class JobQueue:
    def __init__(self):
        self.engine = create_async_engine(settings.database_url, echo=False)
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False)
        self._subscribers: List[asyncio.Queue] = []
        self._running = False

    async def init(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Job queue initialized")

    async def close(self):
        await self.engine.dispose()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self._subscribers:
            self._subscribers.remove(queue)

    async def _notify(self, jobs: List[Job]):
        for queue in self._subscribers:
            try:
                queue.put_nowait([job.to_dict() for job in jobs])
            except asyncio.QueueFull:
                pass

    async def create(self, job: Job) -> Job:
        async with self.session_factory() as session:
            model = JobModel.from_job(job)
            session.add(model)
            await session.commit()
            await session.refresh(model)
            await self._notify(await self.list_all())
            return model.to_job()

    async def get(self, job_id: str) -> Optional[Job]:
        async with self.session_factory() as session:
            result = await session.execute(select(JobModel).where(JobModel.id == job_id))
            model = result.scalar_one_or_none()
            return model.to_job() if model else None

    async def update(self, job: Job) -> Job:
        async with self.session_factory() as session:
            model = await session.get(JobModel, job.id)
            if model:
                model.status = job.status.value
                model.progress = job.progress
                model.speed = job.speed
                model.eta = job.eta
                model.current_title = job.current_title
                model.item_index = job.item_index
                model.item_count = job.item_count
                model.error = job.error
                model.cancel_requested = job.cancel_requested
                model.updated_at = datetime.utcnow()
                await session.commit()
                await session.refresh(model)
                await self._notify(await self.list_all())
                return model.to_job()
            return job

    async def list_all(self) -> List[Job]:
        async with self.session_factory() as session:
            result = await session.execute(select(JobModel).order_by(JobModel.created_at.desc()))
            return [m.to_job() for m in result.scalars().all()]

    async def cancel(self, job_id: str) -> bool:
        async with self.session_factory() as session:
            model = await session.get(JobModel, job_id)
            if model and model.status in (JobStatus.QUEUED, JobStatus.STARTING, JobStatus.DOWNLOADING, JobStatus.PROCESSING):
                model.cancel_requested = True
                await session.commit()
                await self._notify(await self.list_all())
                return True
            return False

    async def clear_finished(self) -> int:
        async with self.session_factory() as session:
            result = await session.execute(
                delete(JobModel).where(JobModel.status.in_([JobStatus.COMPLETED, JobStatus.ERROR, JobStatus.CANCELLED]))
            )
            await session.commit()
            await self._notify(await self.list_all())
            return result.rowcount


job_queue = JobQueue()