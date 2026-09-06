import asyncio
import json
import logging
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, delete, event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import settings
from app.models.job import AudioFormat, DownloadMode, Job, JobStatus, VideoQuality

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
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    eta: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_title: Mapped[str] = mapped_column(String(512), default="")
    item_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    item_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    audio_format: Mapped[str] = mapped_column(String(16), default=AudioFormat.MP3)
    audio_quality: Mapped[str] = mapped_column(String(16), default="320")
    video_quality: Mapped[str] = mapped_column(String(16), default=VideoQuality.BEST)
    folder: Mapped[str] = mapped_column(String(256), default="")
    output_path: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    output_files: Mapped[str | None] = mapped_column(Text, nullable=True)
    playlist_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    failed_items: Mapped[str | None] = mapped_column(Text, nullable=True)

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
            output_path=self.output_path,
            output_files=json.loads(self.output_files) if self.output_files else None,
            playlist_title=self.playlist_title,
            failed_items=json.loads(self.failed_items) if self.failed_items else None,
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
            output_path=job.output_path,
            output_files=json.dumps(job.output_files) if job.output_files else None,
            playlist_title=job.playlist_title,
            failed_items=json.dumps(job.failed_items) if job.failed_items else None,
        )


class JobQueue:
    def __init__(self):
        self.engine = create_async_engine(settings.database_url, echo=False)
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False)
        self._subscribers: list[asyncio.Queue] = []
        self._running = False
        self._main_loop: asyncio.AbstractEventLoop | None = None

        @event.listens_for(self.engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()

    def set_main_loop(self, loop: asyncio.AbstractEventLoop):
        """Store the main FastAPI event loop for use by sync wrappers."""
        self._main_loop = loop
        logger.info("Job queue main loop set")

    async def init(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Job queue initialized (WAL mode)")

    async def close(self):
        await self.engine.dispose()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self._subscribers:
            self._subscribers.remove(queue)

    async def _notify(self, jobs: list[Job]):
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

    async def get(self, job_id: str) -> Job | None:
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
                model.output_path = job.output_path
                model.output_files = json.dumps(job.output_files) if job.output_files else None
                model.playlist_title = job.playlist_title
                model.failed_items = json.dumps(job.failed_items) if job.failed_items else None
                model.updated_at = datetime.utcnow()
                await session.commit()
                await session.refresh(model)
                await self._notify(await self.list_all())
                return model.to_job()
            return job

    def update_sync(self, job: Job) -> None:
        """Synchronous wrapper for update(), safe to call from worker threads.
        Uses the main event loop via run_coroutine_threadsafe instead of
        creating a new loop with asyncio.run() each time.
        """
        if self._main_loop is None:
            # Fallback: should never happen in production
            asyncio.run(self.update(job))
        else:
            future = asyncio.run_coroutine_threadsafe(self.update(job), self._main_loop)
            future.result(timeout=10)

    async def list_all(self) -> list[Job]:
        async with self.session_factory() as session:
            result = await session.execute(select(JobModel).order_by(JobModel.created_at.desc()))
            return [m.to_job() for m in result.scalars().all()]

    async def cancel(self, job_id: str) -> bool:
        async with self.session_factory() as session:
            model = await session.get(JobModel, job_id)
            if model and model.status in (
                JobStatus.QUEUED,
                JobStatus.STARTING,
                JobStatus.DOWNLOADING,
                JobStatus.PROCESSING,
            ):
                model.cancel_requested = True
                await session.commit()
                await self._notify(await self.list_all())
                return True
            return False

    async def clear_finished(self) -> int:
        async with self.session_factory() as session:
            result = await session.execute(
                delete(JobModel).where(
                    JobModel.status.in_([JobStatus.COMPLETED, JobStatus.ERROR, JobStatus.CANCELLED])
                )
            )
            await session.commit()
            await self._notify(await self.list_all())
            return result.rowcount


job_queue = JobQueue()
