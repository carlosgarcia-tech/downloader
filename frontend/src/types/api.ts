export type DownloadMode = 'audio' | 'video';
export type AudioFormat = 'mp3' | 'm4a' | 'flac';
export type VideoQuality = 'best' | '2160' | '1440' | '1080' | '720' | '480';
export type JobStatus = 'queued' | 'starting' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';

export interface SongProgress {
  index: number;
  total: number;
  title: string;
  status: JobStatus;
  progress: number;
  speed?: number;
  eta?: number;
  error?: string;
  filePath?: string;
}

export interface Job {
  id: string;
  url: string;
  mode: DownloadMode;
  status: JobStatus;
  progress: number;
  speed?: number;
  eta?: number;
  current_title: string;
  thumbnail?: string;
  item_index?: number;
  item_count?: number;
  error?: string;
  cancel_requested: boolean;
  created_at: string;
  updated_at: string;
  audio_format: AudioFormat;
  audio_quality: string;
  video_quality: VideoQuality;
  folder: string;
  output_path?: string;
  output_files?: string[];
  playlist_title?: string;
  songs?: SongProgress[];
  is_playlist: boolean;
}

export interface CreateJobRequest {
  urls: string;
  mode: DownloadMode;
  audio_format?: AudioFormat;
  audio_quality?: string;
  video_quality?: VideoQuality;
  folder?: string;
}

export interface CreateJobResponse {
  created: string[];
}

export interface HealthResponse {
  status: string;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  jobId?: string;
  message: string;
  meta?: Record<string, unknown>;
}