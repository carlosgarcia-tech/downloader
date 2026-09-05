import pytest

from app.models.job import DownloadMode, JobStatus
from app.services.job_queue import JobModel


class TestJobQueue:
    @pytest.mark.asyncio
    async def test_create_job(self, test_job_queue, sample_job):
        created = await test_job_queue.create(sample_job)
        assert created.id == sample_job.id
        assert created.url == sample_job.url
        assert created.status == JobStatus.QUEUED

    @pytest.mark.asyncio
    async def test_get_job(self, test_job_queue, sample_job):
        await test_job_queue.create(sample_job)
        retrieved = await test_job_queue.get(sample_job.id)
        assert retrieved is not None
        assert retrieved.id == sample_job.id
        assert retrieved.url == sample_job.url

    @pytest.mark.asyncio
    async def test_get_nonexistent_job(self, test_job_queue):
        retrieved = await test_job_queue.get("nonexistent")
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_update_job(self, test_job_queue, sample_job):
        await test_job_queue.create(sample_job)
        sample_job.status = JobStatus.DOWNLOADING
        sample_job.progress = 50.0
        updated = await test_job_queue.update(sample_job)
        assert updated.status == JobStatus.DOWNLOADING
        assert updated.progress == 50.0

    @pytest.mark.asyncio
    async def test_list_jobs(self, test_job_queue, sample_job, sample_video_job):
        await test_job_queue.create(sample_job)
        await test_job_queue.create(sample_video_job)
        jobs = await test_job_queue.list_all()
        assert len(jobs) == 2

    @pytest.mark.asyncio
    async def test_cancel_job(self, test_job_queue, sample_job):
        await test_job_queue.create(sample_job)
        result = await test_job_queue.cancel(sample_job.id)
        assert result is True
        job = await test_job_queue.get(sample_job.id)
        assert job.cancel_requested is True

    @pytest.mark.asyncio
    async def test_cancel_nonexistent_job(self, test_job_queue):
        result = await test_job_queue.cancel("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_completed_job(self, test_job_queue, sample_job):
        await test_job_queue.create(sample_job)
        sample_job.status = JobStatus.COMPLETED
        await test_job_queue.update(sample_job)
        result = await test_job_queue.cancel(sample_job.id)
        assert result is False

    @pytest.mark.asyncio
    async def test_clear_finished(self, test_job_queue, sample_job, sample_video_job):
        await test_job_queue.create(sample_job)
        await test_job_queue.create(sample_video_job)
        sample_job.status = JobStatus.COMPLETED
        sample_video_job.status = JobStatus.ERROR
        await test_job_queue.update(sample_job)
        await test_job_queue.update(sample_video_job)
        count = await test_job_queue.clear_finished()
        assert count == 2
        jobs = await test_job_queue.list_all()
        assert len(jobs) == 0


class TestJobModel:
    def test_job_model_to_job(self):
        from datetime import datetime

        model = JobModel(
            id="test123",
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            mode="audio",
            status="queued",
            progress=0.0,
            audio_format="mp3",
            audio_quality="320",
            video_quality="best",
            folder="test",
            current_title="",
            cancel_requested=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        job = model.to_job()
        assert job.id == "test123"
        assert str(job.url) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert job.mode == DownloadMode.AUDIO
        assert job.status == JobStatus.QUEUED

    def test_job_model_from_job(self, sample_job):
        model = JobModel.from_job(sample_job)
        assert model.id == sample_job.id
        assert model.url == str(sample_job.url)
        assert model.mode == sample_job.mode.value
        assert model.status == sample_job.status.value
