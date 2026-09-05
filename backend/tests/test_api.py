import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models.job import DownloadMode, Job, JobStatus  # noqa: E402


class TestAPIRoutes:
    @pytest.mark.asyncio
    async def test_create_jobs_audio(self, async_client):
        with patch("app.api.routes.executor.submit") as mock_submit:
            mock_submit.return_value = MagicMock()

            response = await async_client.post(
                "/api/jobs",
                json={
                    "urls": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "mode": "audio",
                    "audio_format": "mp3",
                    "audio_quality": "320",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "created" in data
            assert len(data["created"]) == 1
            assert len(data["created"][0]) == 8

    @pytest.mark.asyncio
    async def test_create_jobs_multiple_urls(self, async_client):
        with patch("app.api.routes.executor.submit") as mock_submit:
            mock_submit.return_value = MagicMock()

            response = await async_client.post(
                "/api/jobs",
                json={
                    "urls": "https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/abc123",
                    "mode": "audio",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["created"]) == 2

    @pytest.mark.asyncio
    async def test_create_jobs_video(self, async_client):
        with patch("app.api.routes.executor.submit") as mock_submit:
            mock_submit.return_value = MagicMock()

            response = await async_client.post(
                "/api/jobs",
                json={
                    "urls": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "mode": "video",
                    "video_quality": "1080",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["created"]) == 1

    @pytest.mark.asyncio
    async def test_create_jobs_invalid_url(self, async_client):
        response = await async_client.post(
            "/api/jobs",
            json={
                "urls": "https://evil.com/video",
                "mode": "audio",
            },
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_create_jobs_empty_urls(self, async_client):
        response = await async_client.post(
            "/api/jobs",
            json={
                "urls": "",
                "mode": "audio",
            },
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_list_jobs(self, async_client):
        with patch("app.api.routes.job_queue.list_all", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = [
                Job(
                    id="test123",
                    url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    mode=DownloadMode.AUDIO,
                    status=JobStatus.QUEUED,
                )
            ]

            response = await async_client.get("/api/jobs")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == "test123"

    @pytest.mark.asyncio
    async def test_cancel_job(self, async_client):
        with patch("app.api.routes.job_queue.cancel", new_callable=AsyncMock) as mock_cancel:
            mock_cancel.return_value = True

            response = await async_client.delete("/api/jobs/test123")
            assert response.status_code == 200
            assert response.json() == {"ok": True}

    @pytest.mark.asyncio
    async def test_cancel_job_not_found(self, async_client):
        with patch("app.api.routes.job_queue.cancel", new_callable=AsyncMock) as mock_cancel:
            mock_cancel.return_value = False

            response = await async_client.delete("/api/jobs/nonexistent")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_clear_finished(self, async_client):
        with patch("app.api.routes.job_queue.clear_finished", new_callable=AsyncMock) as mock_clear:
            mock_clear.return_value = 5

            response = await async_client.post("/api/jobs/clear")
            assert response.status_code == 200
            assert response.json() == {"ok": True, "cleared": 5}

    @pytest.mark.asyncio
    async def test_health_check(self, async_client):
        response = await async_client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestSecurity:
    @pytest.mark.asyncio
    async def test_rate_limiting(self, async_client):
        for _ in range(105):
            response = await async_client.get("/api/health")
            if response.status_code == 429:
                break
        assert response.status_code == 429
        assert "Demasiadas solicitudes" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_cors_headers(self, async_client):
        response = await async_client.options(
            "/api/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )
        assert response.status_code == 200
