'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X, DownloadSimple, ArrowClockwise, CaretDown, CheckCircle, XCircle,
  WarningCircle, Prohibit, Clock, MusicNote, VideoCamera, Playlist, FolderOpen,
} from '@phosphor-icons/react';
import { cn } from '../lib/utils';
import type { Job, SongProgress } from '../types/api';
import { formatSpeed, formatEta } from '../lib/format';

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
  queued: 'badge badge-queued',
  starting: 'badge badge-downloading',
  downloading: 'badge badge-downloading',
  processing: 'badge badge-processing',
  completed: 'badge badge-completed',
  error: 'badge badge-error',
  cancelled: 'badge badge-cancelled',
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'queued':
      return <Clock weight="bold" size={12} />;
    case 'starting':
    case 'downloading':
    case 'processing':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3 h-3 animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      );
    case 'completed':
      return <CheckCircle weight="fill" size={12} />;
    case 'error':
      return <XCircle weight="fill" size={12} />;
    case 'cancelled':
      return <Prohibit weight="bold" size={12} />;
    default:
      return <Clock weight="bold" size={12} />;
  }
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
        'group relative bg-surface border rounded-lg p-4',
        'transition-all duration-200 hover:bg-surface-raised',
        isActive && 'border-action/40',
        isCompleted && 'border-border opacity-80',
        isError && 'border-action/60',
        !isActive && !isCompleted && !isError && 'border-border'
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
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-md object-cover bg-input border border-border',
              isCompleted && 'grayscale'
            )}
          />
        ) : (
          <div
            className={cn(
              'flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-md bg-input border border-border relative overflow-hidden',
              isCompleted && 'grayscale'
            )}
          >
            <span className="relative z-10 text-base text-text-muted"><StatusIcon status={job.status} /></span>
            {isActive && (
              <div className="absolute inset-0 bg-action-dim" />
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
                  <MusicNote weight="bold" size={12} className="text-action-strong" />
                )}
                {job.mode === 'video' && (
                  <VideoCamera weight="bold" size={12} className="text-text-muted" />
                )}
                {job.is_playlist && job.playlist_title && (
                  <span className="text-xs text-text-muted flex items-center gap-1 font-mono">
                    <Playlist weight="bold" size={12} />
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
                  <span className="flex items-center gap-1 text-action-strong">
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
                  <X weight="bold" size={16} />
                </button>
              )}
              {job.status === 'error' && onRetry && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRetry?.(job.id); }}
                  className="btn-ghost p-2 text-action-strong hover:bg-action-dim rounded"
                  aria-label="Reintentar descarga"
                >
                  <ArrowClockwise weight="bold" size={16} />
                </button>
              )}
              {isCompleted && job.songs?.[0]?.filePath && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenFolder?.(job.songs?.[0]?.filePath || ''); }}
                  className="btn-ghost p-2 text-success hover:bg-success/10 hover:text-success rounded"
                  aria-label="Abrir carpeta"
                >
                  <FolderOpen weight="bold" size={16} />
                </button>
              )}
              {isCompleted && (
                <a
                  href={`/api/jobs/${job.id}/download`}
                  onClick={(e) => e.stopPropagation()}
                  className="btn-ghost p-2 text-action-strong hover:bg-action-dim rounded"
                  aria-label={job.output_files ? 'Descargar ZIP' : 'Descargar archivo'}
                >
                  <DownloadSimple weight="bold" size={16} />
                </a>
              )}
              {job.is_playlist && job.songs && job.songs.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                  className="btn-ghost p-2 text-text-muted hover:text-text hover:bg-surface-raised rounded"
                  aria-label={expanded ? 'Contraer playlist' : 'Expandir playlist'}
                >
                  <CaretDown
                    weight="bold"
                    size={16}
                    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                  />
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
                    <div className="flex items-center gap-2 flex-1">
                      <div className={cn('progress-track flex-1 relative overflow-hidden', isCompleted && 'h-1.5')}>
                        {progress > 0 ? (
                          <motion.div
                            className={cn(
                              'progress-fill absolute top-0 left-0 h-full rounded-full',
                              isActive && 'progress-fill-active',
                              isCompleted && 'progress-fill-done'
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{
                              duration: isActive ? 0.5 : 0.4,
                              ease: [0.16, 1, 0.3, 1]
                            }}
                          />
                        ) : isActive ? (
                          <div className="progress-fill progress-fill-indeterminate absolute inset-0 rounded-full" />
                        ) : null}
                      </div>
                      <span className={cn(
                        'text-xs font-mono w-12 text-right',
                        isCompleted ? 'text-success' : 'text-text-muted'
                      )}>
                        {progress > 0 ? `${Math.round(progress)}%` : '---'}
                      </span>
                    </div>
                  </div>

                  {/* Speed and ETA */}
                  {(job.speed || job.eta) && (
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-text-muted">
                      {job.speed && (
                        <span className="flex items-center gap-1 text-action-strong">
                          {formatSpeed(job.speed)}
                        </span>
                      )}
                      {job.eta && (
                        <span className="flex items-center gap-1 text-text-muted">
                          <Clock weight="bold" size={12} />
                          ETA {formatEta(job.eta)}
                        </span>
                      )}
                      {job.item_index && job.item_count && !job.speed && !job.eta && (
                        <span className="flex items-center gap-1 text-text-muted">
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
                className="mt-3 p-3 bg-danger-dim border border-action/30 rounded-lg flex items-start gap-3"
              >
                <WarningCircle weight="fill" size={16} className="text-danger flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-danger font-bold text-sm">Error en la descarga</p>
                  <p className="text-text-muted text-xs mt-1 font-mono break-all">{escapeHtml(job.error)}</p>
                </div>
                {onRetry && (
                  <button
                    onClick={() => onRetry?.(job.id)}
                    className="btn-danger text-xs whitespace-nowrap flex-shrink-0 mt-1"
                  >
                    <ArrowClockwise weight="bold" size={12} className="mr-1" />
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
        'flex items-center gap-2 p-2.5 rounded-md bg-input/60 border border-border/30',
        'transition-all duration-200',
        isActive && 'border-action/40 bg-action-dim',
        isCompleted && 'border-border bg-transparent opacity-80',
        isError && 'border-action/50 bg-danger-dim'
      )}
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      {/* Number */}
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded bg-input border border-border text-text-muted text-[11px] font-mono font-medium">
        {index}/{total}
      </div>

      {/* Status icon */}
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
        <span className="relative text-text-muted"><StatusIcon status={song.status} /></span>
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text truncate">{song.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[11px] font-mono', statusClass)}>{statusLabel}</span>
          {song.speed && (
            <span className="text-[11px] font-mono text-action-strong">
              {formatSpeed(song.speed)}
            </span>
          )}
          {song.eta && (
            <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
              ETA {formatEta(song.eta)}
            </span>
          )}
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="flex-shrink-0 w-20 sm:w-28 flex items-center gap-2">
        <div className="progress-track-thin flex-1">
          {progress > 0 ? (
            <motion.div
              className={cn('progress-fill h-full rounded', isActive && 'progress-fill-active', isCompleted && 'progress-fill-done')}
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
            <WarningCircle weight="fill" size={12} className="text-danger" />
            <span className="tooltip z-50">
              {song.error}
            </span>
          </span>
        </div>
      )}
    </motion.div>
  );
}
