from enum import Enum


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