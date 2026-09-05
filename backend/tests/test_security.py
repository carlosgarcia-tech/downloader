from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, Request
from starlette.responses import Response

from app.core.security import RateLimitMiddleware, validate_url


class TestValidateUrl:
    def test_valid_youtube_urls(self):
        valid_urls = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.music.youtube.com/playlist?list=PL123",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        ]
        for url in valid_urls:
            assert validate_url(url) is True, f"Should be valid: {url}"

    def test_invalid_urls(self):
        invalid_urls = [
            "https://evil.com/video",
            "https://google.com",
            "not-a-url",
            "https://youtube.evil.com/watch?v=123",
            "",
        ]
        for url in invalid_urls:
            assert validate_url(url) is False, f"Should be invalid: {url}"

    def test_ftp_youtube_allowed(self):
        # ftp is technically allowed if domain is youtube.com
        # This is a limitation of the current implementation
        assert validate_url("ftp://youtube.com/video") is True


class TestRateLimitMiddleware:
    @pytest.mark.asyncio
    async def test_allows_requests_under_limit(self):
        middleware = RateLimitMiddleware(None, max_requests=5, window_seconds=60)

        mock_request = MagicMock(spec=Request)
        mock_request.client.host = "127.0.0.1"

        async def mock_call_next(request):
            return Response(content=b"OK", status_code=200)

        for _ in range(5):
            response = await middleware.dispatch(mock_request, mock_call_next)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_blocks_requests_over_limit(self):
        middleware = RateLimitMiddleware(None, max_requests=3, window_seconds=60)

        mock_request = MagicMock(spec=Request)
        mock_request.client.host = "127.0.0.1"

        async def mock_call_next(request):
            return Response(content=b"OK", status_code=200)

        for _ in range(3):
            response = await middleware.dispatch(mock_request, mock_call_next)
            assert response.status_code == 200

        # The 4th request should raise HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, mock_call_next)
        assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_different_ips_separate_limits(self):
        middleware = RateLimitMiddleware(None, max_requests=2, window_seconds=60)

        async def mock_call_next(request):
            return Response(content=b"OK", status_code=200)

        req1 = MagicMock(spec=Request)
        req1.client.host = "192.168.1.1"

        req2 = MagicMock(spec=Request)
        req2.client.host = "192.168.1.2"

        await middleware.dispatch(req1, mock_call_next)
        await middleware.dispatch(req1, mock_call_next)

        response = await middleware.dispatch(req2, mock_call_next)
        assert response.status_code == 200

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(req1, mock_call_next)
        assert exc_info.value.status_code == 429
