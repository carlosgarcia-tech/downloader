import { useMemo } from 'react';
import type { Job } from '../types/api';

interface JobItemProps {
  job: Job;
  onCancel: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'en cola',
  starting: 'iniciando',
  downloading: 'descargando',
  processing: 'procesando',
  completed: 'listo',
  error: 'error',
  cancelled: 'cancelado',
};

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec) return '';
  const kb = bytesPerSec / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB/s`;
  return `${(kb / 1024).toFixed(1)} MB/s`;
}

function formatEta(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `ETA ${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export function JobItem({ job, onCancel }: JobItemProps) {
  const title = useMemo(() => job.current_title || job.url, [job.current_title, job.url]);
  const progress = useMemo(() => Math.max(0, Math.min(100, job.progress || 0)), [job.progress]);
  const statusLabel = STATUS_LABEL[job.status] || job.status;
  const canCancel = ['queued', 'starting', 'downloading', 'processing'].includes(job.status);

  const itemCounter = job.item_index && job.item_count
    ? `pista ${job.item_index}/${job.item_count} · `
    : '';

  const showFootline = job.status === 'downloading' || Boolean(itemCounter);
  const footline = job.status === 'downloading'
    ? `${itemCounter}${formatSpeed(job.speed)} | ${formatEta(job.eta)}`
    : itemCounter;

  return (
    <li className={`job ${job.mode}`} data-id={job.id}>
      <div className="job-top">
        <div className="job-info">
          <div className="job-title">{escapeHtml(title)}</div>
          <div className="job-url">{escapeHtml(job.url)}</div>
        </div>
        <div className="job-meta">
          <span className={`job-status status-${job.status}`}>{statusLabel}</span>
          {canCancel && (
            <button
              className="job-cancel"
              onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
              title="Cancelar"
              aria-label="Cancelar descarga"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="job-bar-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="job-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      {showFootline && (
        <div className="job-footline">
          <span>{footline}</span>
        </div>
      )}
      {job.status === 'error' && job.error && (
        <div className="job-error-text">{escapeHtml(job.error)}</div>
      )}
    </li>
  );
}