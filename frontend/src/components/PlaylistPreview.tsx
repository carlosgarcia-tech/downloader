'use client';

import { Play } from '@phosphor-icons/react';
import type { Job } from '../types/api';
import { formatSpeed, formatEta } from '../lib/format';

interface PlaylistPreviewProps {
  jobs: Job[];
}

const ROW_STATUS: Record<string, string> = {
  processing: 'Post',
  completed: '✓',
  error: 'Error',
  queued: 'En cola',
};

/**
 * Right-column context panel: sticky playlist preview with a blended hero
 * cover (mix-blend-luminosity, color restored on hover) and an optimized
 * tabular tracklist. Picks the first active playlist, else the most recent.
 */
export function PlaylistPreview({ jobs }: PlaylistPreviewProps) {
  const candidates = jobs.filter(j => j.is_playlist && j.songs && j.songs.length > 0);
  const job = candidates.find(j =>
    ['starting', 'downloading', 'processing', 'queued'].includes(j.status)
  ) || candidates[0];

  if (!job) return null;

  const activeCount = (job.songs || []).filter(
    s => s.status === 'downloading' || s.status === 'processing'
  ).length;
  const doneCount = (job.songs || []).filter(s => s.status === 'completed').length;

  return (
    <div className="preview-card panel overflow-hidden sticky top-8 animate-fade-in">
      {/* Hero cover blended into the panel; color returns on hover */}
      <div className="relative h-40 border-b border-border overflow-hidden">
        {job.thumbnail ? (
          <img
            src={job.thumbnail}
            alt=""
            className="preview-cover absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-action/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="font-display font-extrabold text-text text-lg leading-tight line-clamp-2">
            {job.playlist_title || job.current_title || 'Playlist'}
          </h2>
          <p className="text-text-muted text-xs font-mono mt-1">
            {job.songs?.length} pistas
            {doneCount > 0 && ` · ${doneCount} listas`}
            {activeCount > 0 && ` · ${activeCount} activas`}
          </p>
        </div>
      </div>

      {/* Tracklist — tabular, optimized for scanning */}
      <div className="max-h-[480px] overflow-y-auto">
        <ul className="divide-y divide-border/40">
          {(job.songs || []).map((song) => {
            const isActive = song.status === 'downloading' || song.status === 'processing';
            const isCompleted = song.status === 'completed';
            return (
              <li
                key={`${job.id}-${song.index}`}
                className="track-row flex items-center gap-3 px-4 py-2.5 hover:bg-surface-raised/70 transition-colors"
              >
                {/* Track number becomes a red play icon on hover */}
                <span className="row-number flex-shrink-0 w-6 text-right text-xs font-mono text-text-dim">
                  {song.index}
                </span>
                <span className="row-play flex-shrink-0 w-6 justify-center items-center" aria-hidden="true">
                  <Play weight="fill" size={13} />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm text-text">
                    {song.title || `Pista ${song.index}`}
                  </span>
                  {isActive && (
                    <span className="block text-[11px] font-mono text-text-muted mt-0.5">
                      {song.speed ? `${formatSpeed(song.speed)}${song.eta ? ` · ETA ${formatEta(song.eta)}` : ''}` : 'Conectando…'}
                    </span>
                  )}
                </span>

                <span
                  className={`flex-shrink-0 text-[11px] font-mono ${
                    isCompleted
                      ? 'text-success'
                      : song.status === 'error'
                        ? 'text-danger'
                        : isActive
                          ? 'text-action-strong'
                          : 'text-text-dim'
                  }`}
                >
                  {isActive
                    ? `${Math.round(song.progress || 0)}%`
                    : (ROW_STATUS[song.status] || '')}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
