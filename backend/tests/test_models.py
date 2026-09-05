import pytest
from pydantic import ValidationError

from app.models.job import (
    Job,
    JobStatus,
    JobCreate,
    JobParams,
    DownloadMode,
    AudioFormat,
    VideoQuality,
)


class TestJobModels:
    def test_download_mode_enum(self):
        assert DownloadMode.AUDIO == "audio"
        assert DownloadMode.VIDEO == "video"

    def test_audio_format_enum(self):
        assert AudioFormat.MP3 == "mp3"
        assert AudioFormat.M4A == "m4a"
        assert AudioFormat.FLAC == "flac"

    def test_video_quality_enum(self):
        assert VideoQuality.BEST == "best"
        assert VideoQuality.Q1080 == "1080"
        assert VideoQuality.Q720 == "720"

    def test_job_params_valid(self):
        params = JobParams(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            mode=DownloadMode.AUDIO,
            audio_format=AudioFormat.MP3,
            audio_quality="320",
            video_quality=VideoQuality.BEST,
            folder="test",
        )
        assert str(params.url) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert params.folder == "test"

    def test_job_params_sanitizes_folder(self):
        params = JobParams(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            mode=DownloadMode.AUDIO,
            folder="test@#$%^&*()",
        )
        assert params.folder == "test"

    def test_job_params_empty_folder(self):
        params = JobParams(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            mode=DownloadMode.AUDIO,
            folder="",
        )
        assert params.folder == ""

    def test_job_params_invalid_url(self):
        with pytest.raises(ValidationError):
            JobParams(
                url="not-a-url",
                mode=DownloadMode.AUDIO,
            )

    def test_job_params_invalid_domain(self):
        # HttpUrl only validates URL format, not domain
        # Domain validation is done in security.validate_url
        params = JobParams(
            url="https://evil.com/video",
            mode=DownloadMode.AUDIO,
        )
        assert str(params.url) == "https://evil.com/video"

    def test_job_create(self):
        create = JobCreate(
            urls="https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/abc123",
            mode=DownloadMode.AUDIO,
        )
        assert len(create.urls.splitlines()) == 2

    def test_job_defaults(self):
        job = Job(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            mode=DownloadMode.AUDIO,
        )
        assert job.status == JobStatus.QUEUED
        assert job.progress == 0.0
        assert job.audio_format == AudioFormat.MP3
        assert job.audio_quality == "320"
        assert job.video_quality == VideoQuality.BEST
        assert job.id is not None
        assert len(job.id) == 8

    def test_job_to_dict(self):
        job = Job(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            mode=DownloadMode.AUDIO,
        )
        d = job.to_dict()
        assert d["url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert d["mode"] == "audio"
        assert d["status"] == "queued"
        assert "id" in d