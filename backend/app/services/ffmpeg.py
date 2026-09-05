import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class FFmpegNotFoundError(RuntimeError):
    pass


def verify_ffmpeg() -> Path:
    for cmd in ("ffmpeg", "ffmpeg.exe"):
        try:
            result = subprocess.run(
                [cmd, "-version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                logger.info("FFmpeg found: %s", cmd)
                return Path(cmd)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue

    raise FFmpegNotFoundError(
        "FFmpeg no encontrado en PATH. Instálalo:\n"
        "  - Windows: winget install ffmpeg\n"
        "  - Mac: brew install ffmpeg\n"
        "  - Linux: sudo apt install ffmpeg"
    )


def get_ffmpeg_path() -> Path:
    return verify_ffmpeg()