from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl, validator
import uuid


class JobStatus(str, Enum):
    QUEUED = "queued"
    STARTING = "starting"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


class DownloadMode(str, Enum):
    AUDIO = "audio"
    VIDEO = "video"


class AudioFormat(str, Enum):
    MP3 = "mp3"
    M4A = "m4a"
    FLAC = "flac"


class VideoQuality(str, Enum):
    BEST = "best"
    Q2160 = "2160"
    Q1440 = "1440"
    Q1080 = "1080"
    Q720 = "720"
    Q480 = "480"


class JobParams(BaseModel):
    url: HttpUrl
    mode: DownloadMode
    audio_format: AudioFormat = AudioFormat.MP3
    audio_quality: str = "320"
    video_quality: VideoQuality = VideoQuality.BEST
    folder: str = ""

    @validator("folder")
    @classmethod
    def sanitize_folder(cls, v: str) -> str:
        if not v:
            return ""
        safe = "".join(c for c in v if c.isalnum() or c in (" ", "-", "_", ".")).strip()
        return safe[:100]


class JobCreate(BaseModel):
    urls: str
    mode: DownloadMode
    audio_format: AudioFormat = AudioFormat.MP3
    audio_quality: str = "320"
    video_quality: VideoQuality = VideoQuality.BEST
    folder: str = ""


class Job(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    url: HttpUrl
    mode: DownloadMode
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    speed: Optional[float] = None
    eta: Optional[int] = None
    current_title: str = ""
    item_index: Optional[int] = None
    item_count: Optional[int] = None
    error: Optional[str] = None
    cancel_requested: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    audio_format: AudioFormat = AudioFormat.MP3
    audio_quality: str = "320"
    video_quality: VideoQuality = VideoQuality.BEST
    folder: str = ""

    def to_dict(self) -> dict:
        return self.model_dump(mode="json")