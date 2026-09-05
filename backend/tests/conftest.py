import asyncio
import pytest
import pytest_asyncio
import sys
import tempfile
import os
from pathlib import Path
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend directory to path for main.py import
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from main import app
from app.config import settings
from app.services.job_queue import Base, job_queue, JobQueue
from app.models.job import Job, JobStatus, DownloadMode, AudioFormat, VideoQuality


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
def test_db():
    # Use a temporary file for SQLite to avoid in-memory issues with aiosqlite
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    async def setup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    asyncio.run(setup())

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    yield session_factory

    asyncio.run(engine.dispose())
    try:
        os.unlink(db_path)
    except:
        pass


@pytest.fixture(scope="function")
def test_job_queue(test_db):
    queue = JobQueue()
    queue.session_factory = test_db
    asyncio.run(queue.init())
    yield queue
    asyncio.run(queue.close())


@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def sample_job():
    return Job(
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        mode=DownloadMode.AUDIO,
        audio_format=AudioFormat.MP3,
        audio_quality="320",
        video_quality=VideoQuality.BEST,
        folder="test_folder",
    )


@pytest.fixture
def sample_video_job():
    return Job(
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        mode=DownloadMode.VIDEO,
        video_quality=VideoQuality.Q1080,
        folder="test_video",
    )