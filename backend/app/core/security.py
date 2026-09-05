from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
from collections import defaultdict
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        self.requests[client_ip] = [
            ts for ts in self.requests[client_ip] if now - ts < self.window_seconds
        ]

        if len(self.requests[client_ip]) >= self.max_requests:
            logger.warning("Rate limit exceeded for %s", client_ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas solicitudes. Intenta más tarde.",
            )

        self.requests[client_ip].append(now)
        return await call_next(request)


def validate_url(url: str) -> bool:
    allowed_domains = (
        "youtube.com",
        "youtu.be",
        "music.youtube.com",
        "www.youtube.com",
        "m.youtube.com",
    )
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return any(parsed.netloc.endswith(domain) for domain in allowed_domains)
    except Exception:
        return False