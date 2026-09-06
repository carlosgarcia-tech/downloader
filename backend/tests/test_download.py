from unittest.mock import MagicMock, patch

from app.models.job import AudioFormat, JobStatus, Job, VideoQuality
from app.services.download import _build_single_ydl_opts, download_worker


class TestBuildYdlOpts:
    def test_build_audio_opts(self, sample_job, tmp_path):
        sample_job.folder = "test_artist"
        sample_job.audio_format = AudioFormat.MP3
        sample_job.audio_quality = "320"

        callback = MagicMock()
        opts = _build_single_ydl_opts(sample_job, callback)

        assert opts["format"] == "bestaudio/best"
        assert "FFmpegExtractAudio" in str(opts["postprocessors"])
        assert opts["postprocessors"][0]["preferredcodec"] == "mp3"
        assert opts["postprocessors"][0]["preferredquality"] == "320"
        assert "test_artist" in opts["outtmpl"]

    def test_build_video_opts(self, sample_video_job, tmp_path):
        sample_video_job.folder = "test_playlist"
        sample_video_job.video_quality = VideoQuality.Q1080

        callback = MagicMock()
        opts = _build_single_ydl_opts(sample_video_job, callback)

        assert "bestvideo[height<=1080]+bestaudio" in opts["format"]
        assert opts["merge_output_format"] == "mp4"
        assert "test_playlist" in opts["outtmpl"]

    def test_build_video_best_quality(self, sample_video_job, tmp_path):
        sample_video_job.video_quality = VideoQuality.BEST

        callback = MagicMock()
        opts = _build_single_ydl_opts(sample_video_job, callback)

        assert "bestvideo+bestaudio" in opts["format"]
        assert "[height<=" not in opts["format"]

    def test_common_opts(self, sample_job):
        callback = MagicMock()
        opts = _build_single_ydl_opts(sample_job, callback)

        assert opts["windowsfilenames"] is True
        assert opts["quiet"] is True
        assert opts["no_warnings"] is True
        assert opts["ignoreerrors"] == "only_download"
        assert "progress_hooks" in opts
        assert opts["writethumbnail"] is True


class TestDownloadWorker:
    def test_download_worker_success(self, sample_job):
        with patch("app.services.download.yt_dlp.YoutubeDL") as mock_ydl:
            mock_instance = MagicMock()
            mock_ydl.return_value.__enter__.return_value = mock_instance

            callback = MagicMock()
            result = download_worker(sample_job, callback)

            assert result.status == JobStatus.COMPLETED
            assert result.progress == 100.0
            callback.assert_called()

    def test_download_worker_cancelled(self, sample_job):
        sample_job.cancel_requested = True

        with patch("app.services.download.yt_dlp.YoutubeDL") as mock_ydl:
            mock_instance = MagicMock()
            mock_ydl.return_value.__enter__.return_value = mock_instance

            callback = MagicMock()
            result = download_worker(sample_job, callback)

            assert result.status == JobStatus.CANCELLED

    def test_download_worker_error(self, sample_job):
        from yt_dlp.utils import DownloadError as YTDLPDownloadError

        with patch("app.services.download.yt_dlp.YoutubeDL") as mock_ydl:
            mock_instance = MagicMock()
            mock_ydl.return_value.__enter__.return_value = mock_instance
            mock_instance.download.side_effect = YTDLPDownloadError("Video unavailable")

            callback = MagicMock()
            result = download_worker(sample_job, callback)

            assert result.status == JobStatus.ERROR
            assert "Video unavailable" in result.error
