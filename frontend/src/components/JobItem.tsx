'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import type { Job, SongProgress } from '../types/api';

interface JobItemProps {
  job: Job;
  onCancel: (_id: string) => void;
  onRetry?: (_id: string) => void;
  onOpenFolder?: (_path: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  queuedIndex?: number;
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'En cola',
  starting: 'Iniciando',
  downloading: 'Descargando',
  processing: 'Procesando',
  completed: 'Completado',
  error: 'Error',
  cancelled: 'Cancelado',
};

const STATUS_CLASSES: Record<string, string> = {
  queued: 'badge-queued',
  starting: 'badge-downloading',
  downloading: 'badge-downloading',
  processing: 'badge-processing',
  completed: 'badge-completed',
  error: 'badge-error',
  cancelled: 'badge-cancelled',
};

function StatusIcon({ status }: { status: string }) {
  const size = "w-3 h-3";
  switch (status) {
    case 'queued':
      return (
        <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      );
    case 'starting':
    case 'downloading':
    case 'processing':
      return (
        <svg className={cn(size, "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      );
    case 'completed':
      return (
        <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      );
    case 'error':
      return (
        <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      );
    case 'cancelled':
      return (
        <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      );
    default:
      return (
        <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      );
  }
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec) return '';
  const kb = bytesPerSec / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB/s`;
  return `${(kb / 1024).toFixed(1)} MB/s`;
}

function formatEta(seconds?: number): string {
  if (!seconds || seconds < 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function JobItem({
  job,
  onCancel,
  onRetry,
  onOpenFolder,
  expanded = false,
  onToggleExpand,
  queuedIndex
}: JobItemProps) {
  const hasTitle = Boolean(job.current_title);
  const title = job.current_title || job.url;
  const progress = Math.max(0, Math.min(100, job.progress || 0));
  const statusLabel = STATUS_LABEL[job.status] || job.status;
  const statusClass = STATUS_CLASSES[job.status] || 'badge-queued';
  const canCancel = ['queued', 'starting', 'downloading', 'processing'].includes(job.status);

  const isActive = ['starting', 'downloading', 'processing'].includes(job.status);
  const isCompleted = job.status === 'completed';
  const isError = job.status === 'error';

  return (
    <motion.li
      key={job.id}
      className={cn(
        'group relative bg-surface border border-border rounded p-4',
        'transition-all duration-200 hover:bg-surface-raised',
        isActive && 'ring-1 ring-warning/30',
        isCompleted && 'ring-1 ring-success/20',
        isError && 'ring-1 ring-danger/30'
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      layout
    >
      {/* Main job row */}
      <div className="relative flex items-start gap-3">
        {/* Thumbnail or status indicator */}
        {job.thumbnail ? (
          <img
            src={job.thumbnail}
            alt=""
            className="flex-shrink-0 w-10 h-10 rounded object-cover bg-bg border border-border"
          />
        ) : (
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded bg-bg border border-border relative overflow-hidden">
            <span className="relative z-10 text-base text-text-muted"><StatusIcon status={job.status} /></span>
            {isActive && (
              <div className="absolute inset-0 bg-action/5" />
            )}
          </div>
        )}

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap gap-y-1">
                <h3 className="font-medium text-text truncate sm:pr-4 font-display">
                  {escapeHtml(title)}
                </h3>
                <span className={cn('whitespace-nowrap', statusClass)}>
                  {job.status === 'queued' && queuedIndex !== undefined
                    ? `En cola · #${queuedIndex + 1}`
                    : statusLabel}
                </span>
                {job.mode === 'audio' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-action">
                    <circle cx="12" cy="12" r="10"/>
                    <polygon points="10 8 16 12 10 16 10 8"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                  </svg>
                )}
                {job.mode === 'video' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <polygon points="23 7 16 12 23 17 23 7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2"/>
                  </svg>
                )}
                {job.is_playlist && job.playlist_title && (
                  <span className="text-xs text-text-muted flex items-center gap-1 font-mono">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    {escapeHtml(job.playlist_title)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-text-muted text-sm font-mono">
                {hasTitle ? (
                  <span className="break-all line-clamp-2">{escapeHtml(job.url)}</span>
                ) : (
                  <span className="text-text-dim italic">Resolviendo título…</span>
                )}
                {job.item_index && job.item_count && (
                  <span className="flex items-center gap-1 text-action">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polygon points="10 8 16 12 10 16 10 8"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                    </svg>
                    {`Pista ${job.item_index}/${job.item_count}`}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isActive && canCancel && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
                  className="btn-ghost p-2 text-danger hover:bg-danger/10 hover:text-danger rounded"
                  aria-label="Cancelar descarga"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
              {job.status === 'error' && onRetry && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRetry?.(job.id); }}
                  className="btn-ghost p-2 text-warning hover:bg-warning/10 hover:text-warning rounded"
                  aria-label="Reintentar descarga"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                </button>
              )}
              {isCompleted && job.songs?.[0]?.filePath && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenFolder(job.songs?.[0]?.filePath || ''); }}
                  className="btn-ghost p-2 text-success hover:bg-success/10 hover:text-success rounded"
                  aria-label="Abrir carpeta"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </button>
              )}
              {isCompleted && (
                <a
                  href={`/api/jobs/${job.id}/download`}
                  onClick={(e) => e.stopPropagation()}
                  className="btn-ghost p-2 text-action hover:bg-action/10 hover:text-action rounded"
                  aria-label={job.output_files ? 'Descargar ZIP' : 'Descargar archivo'}
                >
                  {job.output_files ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  )}
                </a>
              )}
              {job.is_playlist && job.songs && job.songs.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                  className="btn-ghost p-2 text-text-muted hover:text-text hover:bg-surface-raised rounded"
                  aria-label={expanded ? 'Contraer playlist' : 'Expandir playlist'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                    <path d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <AnimatePresence mode="wait">
            {(progress > 0 || isActive || isCompleted) && (
              <motion.div
                key="progress"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="progress-track flex-1 relative overflow-hidden">
                        {progress > 0 ? (
                          <motion.div
                            className="progress-fill absolute top-0 left-0 h-full rounded"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{
                              duration: isActive ? 0.5 : 0.4,
                              ease: [0.16, 1, 0.3, 1]
                            }}
                          />
                        ) : isActive ? (
                          <div className="progress-fill progress-fill-indeterminate absolute inset-0" />
                        ) : null}
                      </div>
                      <span className="text-xs font-mono text-text-muted w-12 text-right">
                        {progress > 0 ? `${Math.round(progress)}%` : '---'}
                      </span>
                    </div>
                  </div>

                  {/* Speed and ETA */}
                  {(job.speed || job.eta) && (
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-text-muted">
                      {job.speed && (
                        <span className="flex items-center gap-1 text-action">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          {formatSpeed(job.speed)}
                        </span>
                      )}
                      {job.eta && (
                        <span className="flex items-center gap-1 text-text-muted">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          ETA {formatEta(job.eta)}
                        </span>
                      )}
                      {job.item_index && job.item_count && !job.speed && !job.eta && (
                        <span className="flex items-center gap-1 text-text-muted">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polygon points="10 8 16 12 10 16 10 8"/>
                            <line x1="12" y1="8" x2="12" y2="16"/>
                          </svg>
                          {`Pista ${job.item_index}/${job.item_count}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error display */}
          <AnimatePresence mode="wait">
            {isError && job.error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-danger-dim border border-danger/20 rounded flex items-start gap-3"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <div className="flex-1">
                  <p className="text-danger font-medium text-sm font-display">Error en la descarga</p>
                  <p className="text-text-muted text-xs mt-1 font-mono break-all">{escapeHtml(job.error)}</p>
                </div>
                {onRetry && (
                  <button
                    onClick={() => onRetry?.(job.id)}
                    className="btn-danger text-xs whitespace-nowrap flex-shrink-0 mt-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Reintentar
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Playlist/Songs expansion */}
      <AnimatePresence mode="wait">
        {job.is_playlist && expanded && job.songs && job.songs.length > 0 && (
          <motion.div
            key="playlist-expansion"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border/30"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs font-medium text-text-muted font-mono">
                {job.songs.length} canciones
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {(job.songs || []).map((song, index) => (
                <SongItem
                  key={`${job.id}-${song.index}`}
                  song={song}
                  index={index + 1}
                  total={(job.songs || []).length}
                  isActive={song.status === 'downloading' || song.status === 'processing'}
                  isCompleted={song.status === 'completed'}
                  isError={song.status === 'error'}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

interface SongItemProps {
  song: SongProgress;
  index: number;
  total: number;
  isActive: boolean;
  isCompleted: boolean;
  isError: boolean;
}

function SongItem({ song, index, total, isActive, isCompleted, isError }: SongItemProps) {
  const progress = Math.max(0, Math.min(100, song.progress || 0));
  const statusLabel = STATUS_LABEL[song.status] || song.status;
  const statusClass = STATUS_CLASSES[song.status] || 'badge-queued';

  return (
    <motion.div
      className={cn(
        'flex items-center gap-2 p-2.5 rounded bg-bg/50 border border-border/30',
        'transition-all duration-200',
        isActive && 'ring-1 ring-warning/30 bg-action/5',
        isCompleted && 'ring-1 ring-success/20 bg-success/5',
        isError && 'ring-1 ring-danger/30 bg-danger/5'
      )}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      {/* Number */}
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded bg-bg border border-border text-text-muted text-[11px] font-mono font-medium">
        {index}/{total}
      </div>

      {/* Status icon */}
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
        <span className="relative text-text-muted"><StatusIcon status={song.status} /></span>
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text truncate font-display">{song.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[11px] font-mono', statusClass)}>{statusLabel}</span>
          {song.speed && (
            <span className="text-[11px] font-mono text-action flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              {formatSpeed(song.speed)}
            </span>
          )}
          {song.eta && (
            <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {formatEta(song.eta)}
            </span>
          )}
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="flex-shrink-0 w-20 sm:w-28 flex items-center gap-2">
        <div className="progress-track flex-1 h-1.5">
          {progress > 0 ? (
            <motion.div
              className="progress-fill h-full rounded"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : isActive ? (
            <div className="progress-fill progress-fill-indeterminate" />
          ) : null}
        </div>
        {progress > 0 && (
          <span className="text-[10px] font-mono text-text-muted w-8 text-right">
            {Math.round(progress)}%
          </span>
        )}
      </div>

      {/* Error tooltip */}
      {isError && song.error && (
        <div className="ml-auto flex-shrink-0">
          <span className="has-tooltip relative cursor-help">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span className="tooltip z-50">
              {song.error}
            </span>
          </span>
        </div>
      )}
    </motion.div>
  );
}
