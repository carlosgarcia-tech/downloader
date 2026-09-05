'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import type { Job, SongProgress } from '../types/api';
import { X, Music, Video, Loader2, CheckCircle, AlertCircle, FileDown, Clock } from 'lucide-react';

interface JobItemProps {
  job: Job;
  onCancel: (_id: string) => void;
  onRetry?: (_id: string) => void;
  onOpenFolder?: (_path: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
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

const STATUS_COLORS: Record<string, string> = {
  queued: 'badge-queued',
  starting: 'badge-starting',
  downloading: 'badge-downloading',
  processing: 'badge-processing',
  completed: 'badge-completed',
  error: 'badge-error',
  cancelled: 'badge-cancelled',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  queued: <Clock className="w-3 h-3" />,
  starting: <Loader2 className="w-3 h-3 animate-spin" />,
  downloading: <Loader2 className="w-3 h-3 animate-spin text-amber-400" />,
  processing: <Loader2 className="w-3 h-3 animate-spin text-teal-400" />,
  completed: <CheckCircle className="w-3 h-3 text-green-400" />,
  error: <AlertCircle className="w-3 h-3 text-red-400" />,
  cancelled: <X className="w-3 h-3 text-text-muted" />,
};

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
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

const shimmerClassName = 'bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer bg-[length:200%_100%]';

export function JobItem({ 
  job, 
  onCancel, 
  onRetry, 
  onOpenFolder,
  expanded = false,
  onToggleExpand 
}: JobItemProps) {
  const title = job.current_title || job.url;
  const progress = Math.max(0, Math.min(100, job.progress || 0));
  const statusLabel = STATUS_LABEL[job.status] || job.status;
  const statusColor = STATUS_COLORS[job.status] || 'badge-queued';
  const statusIcon = STATUS_ICONS[job.status] || <Clock className="w-3 h-3" />;
  const canCancel = ['queued', 'starting', 'downloading', 'processing'].includes(job.status);
  const isVideo = job.mode === 'video';
  const isPlaylist = job.is_playlist && job.songs && job.songs.length > 0;
  
  const itemCounter = job.item_index && job.item_count
    ? `Pista ${job.item_index}/${job.item_count}`
    : '';

  const isActive = ['starting', 'downloading', 'processing'].includes(job.status);
  const isCompleted = job.status === 'completed';
  const isError = job.status === 'error';

  return (
    <motion.li
      key={job.id}
      className={cn(
        'group relative bg-panel/80 backdrop-blur-sm border border-line/50 rounded-2xl p-5',
        'transition-all duration-300 hover:border-line/80 hover:bg-panel',
        'overflow-hidden',
        isActive && 'ring-1 ring-amber-500/20',
        isCompleted && 'ring-1 ring-green-500/20',
        isError && 'ring-1 ring-red-500/20'
      )}
      initial={{ opacity: 0, y: 20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      layout
    >
      {/* Animated background shimmer for active downloads */}
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-teal-500/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Main job row */}
      <div className="relative flex items-start gap-4">
        {/* Status indicator with icon */}
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-panel-raised/50 border border-line/50 relative overflow-hidden">
          <span className="relative z-10 text-lg">{statusIcon}</span>
          {isActive && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-teal-500/10"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap gap-y-1">
                <h3 className="font-display font-medium text-text truncate pr-4">
                  {escapeHtml(title)}
                </h3>
                <span className={cn('whitespace-nowrap', statusColor)}>
                  {statusLabel}
                </span>
                {job.mode === 'audio' && <Music className="w-3 h-3 text-amber-400" />}
                {job.mode === 'video' && <Video className="w-3 h-3 text-teal-400" />}
                {isPlaylist && job.playlist_title && (
                  <span className="text-xs text-text-muted/70 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2M5 11V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {escapeHtml(job.playlist_title)}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-text-muted/70 text-sm font-mono">
                <span className="truncate max-w-[300px]">{escapeHtml(job.url)}</span>
                {itemCounter && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Music className="w-3 h-3" />
                    {itemCounter}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isActive && canCancel && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
                  className="btn-ghost p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg"
                  aria-label="Cancelar descarga"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
              {isError && onRetry && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); onRetry?.(job.id); }}
                  className="btn-ghost p-2 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 rounded-lg"
                  aria-label="Reintentar descarga"
                >
                  <Loader2 className="w-4 h-4" />
                </motion.button>
              )}
              {isCompleted && job.songs?.[0]?.filePath && onOpenFolder && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); onOpenFolder(job.songs?.[0]?.filePath || ''); }}
                  className="btn-ghost p-2 text-green-400 hover:bg-green-500/10 hover:text-green-300 rounded-lg"
                  aria-label="Abrir carpeta"
                >
                  <FileDown className="w-4 h-4" />
                </motion.button>
              )}
              {isPlaylist && onToggleExpand && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                  className="btn-ghost p-2 text-text-muted hover:text-text hover:bg-panel-raised rounded-lg"
                  aria-label={expanded ? 'Contraer playlist' : 'Expandir playlist'}
                >
                  <motion.svg
                    className="w-4 h-4 transition-transform duration-200"
                    animate={{ rotate: expanded ? 180 : 0 }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </motion.button>
              )}
            </div>
          </div>

          {/* Progress bar with enhanced visuals */}
          <AnimatePresence mode="wait">
            {(progress > 0 || isActive || isCompleted) && (
              <motion.div
                key="progress"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'progress-track flex-1 relative overflow-hidden',
                        isVideo ? 'bg-teal-500/10' : 'bg-amber-500/10'
                      )}>
                        {progress > 0 ? (
                          <motion.div
                            className={cn(
                              'progress-fill absolute top-0 left-0 h-full rounded-full',
                              isVideo ? 'progress-fill-video' : ''
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ 
                              duration: isActive ? 0.5 : 0.3, 
                              ease: 'easeOut',
                              type: 'spring',
                              stiffness: 100,
                              damping: 15
                            }}
                            style={{ 
                              background: isVideo 
                                ? 'linear-gradient(90deg, #4fb0a8, #06b6d4)' 
                                : 'linear-gradient(90deg, #e8a33d, #fbbf24)'
                            }}
                          >
                            {isActive && progress > 5 && progress < 95 && (
                              <div className={shimmerClassName} style={{ width: '100%', height: '100%' }} />
                            )}
                          </motion.div>
                        ) : (
                          <div className={cn('progress-fill-indeterminate absolute inset-0', isVideo ? 'from-teal-500/30 via-teal-400/10 to-transparent' : 'from-amber-500/30 via-amber-400/10 to-transparent')} />
                        )}
                      </div>
                      <span className="text-xs font-mono text-text-muted/70 w-14 text-right">
                        {progress > 0 ? `${Math.round(progress)}%` : '---'}
                      </span>
                    </div>
                  </div>

                  {/* Speed and ETA */}
                  {(job.speed || job.eta) && (
                    <div className="flex items-center gap-4 mt-2 text-xs font-mono text-text-muted/70">
                      {job.speed && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {formatSpeed(job.speed)}
                        </span>
                      )}
                      {job.eta && (
                        <span className="flex items-center gap-1 text-teal-400">
                          <Clock className="w-3 h-3" />
                          ETA {formatEta(job.eta)}
                        </span>
                      )}
                      {itemCounter && !job.speed && !job.eta && (
                        <span className="flex items-center gap-1 text-text-muted/70">
                          <Music className="w-3 h-3" />
                          {itemCounter}
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
                className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-400 font-medium text-sm">Error en la descarga</p>
                  <p className="text-text-muted/80 text-xs mt-1 font-mono break-all">{escapeHtml(job.error)}</p>
                </div>
                {onRetry && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onRetry?.(job.id)}
                    className="btn-danger text-xs whitespace-nowrap flex-shrink-0 mt-1"
                  >
                    <Loader2 className="w-3 h-3 mr-1" />
                    Reintentar
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Playlist/Songs expansion */}
      <AnimatePresence mode="wait">
        {isPlaylist && expanded && job.songs && job.songs.length > 0 && (
          <motion.div
            key="playlist-expansion"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-line/30"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="w-8 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {job.songs.length} canciones
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-amber-500/50 to-transparent" />
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(job.songs || []).map((song, index) => (
                <SongItem
                  key={`${job.id}-${song.index}`}
                  song={song}
                  index={index + 1}
                  total={(job.songs || []).length}
                  isActive={song.status === 'downloading' || song.status === 'processing'}
                  isCompleted={song.status === 'completed'}
                  isError={song.status === 'error'}
                  mode={job.mode}
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
  mode: 'audio' | 'video';
}

function SongItem({ song, index, total, isActive, isCompleted, isError, mode }: SongItemProps) {
  const isVideo = mode === 'video';
  const progress = Math.max(0, Math.min(100, song.progress || 0));
  const statusLabel = STATUS_LABEL[song.status] || song.status;
  const statusColor = STATUS_COLORS[song.status] || 'badge-queued';
  const statusIcon = STATUS_ICONS[song.status] || <Clock className="w-3 h-3" />;

  return (
    <motion.div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl bg-panel/50 border border-line/30',
        'transition-all duration-200',
        isActive && 'ring-1 ring-amber-500/20 bg-amber-500/5',
        isCompleted && 'ring-1 ring-green-500/20 bg-green-500/5',
        isError && 'ring-1 ring-red-500/20 bg-red-500/5'
      )}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      {/* Number */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-panel-raised/50 border border-line/30 text-text-muted/60 text-xs font-mono font-medium">
        {index}/{total}
      </div>

      {/* Status icon */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
        <span className="relative">{statusIcon}</span>
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text truncate">{song.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs', statusColor)}>{statusLabel}</span>
          {song.speed && (
            <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {formatSpeed(song.speed)}
            </span>
          )}
          {song.eta && (
            <span className="text-xs font-mono text-teal-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatEta(song.eta)}
            </span>
          )}
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="flex-shrink-0 w-32 flex items-center gap-2">
        <div className={cn('progress-track flex-1 h-1.5')}>
          {progress > 0 ? (
            <motion.div
              className={cn('progress-fill h-full rounded-full', isVideo ? 'progress-fill-video' : '')}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          ) : isActive ? (
            <div className={shimmerClassName} />
          ) : null}
        </div>
        {progress > 0 && (
          <span className="text-[10px] font-mono text-text-muted/60 w-10 text-right">
            {Math.round(progress)}%
          </span>
        )}
      </div>

      {/* Error tooltip */}
      {isError && song.error && (
        <div className="ml-auto flex-shrink-0">
          <span className="has-tooltip relative cursor-help">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="tooltip z-50">
              {song.error}
            </span>
          </span>
        </div>
      )}
    </motion.div>
  );
}