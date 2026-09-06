'use client';

import { motion } from 'framer-motion';
import type { Job } from '../types/api';
import { JobItem } from './JobItem';

interface PlaylistViewProps {
  jobs: Job[];
  onCancel: (_id: string) => void;
  onRetry?: (_id: string) => void;
  onOpenFolder?: (_path: string) => void;
}

export function PlaylistView({ jobs, onCancel, onRetry, onOpenFolder }: PlaylistViewProps) {
  const playlistJobs = jobs.filter(j => j.is_playlist && j.songs && j.songs.length > 0);
  const singleJobs = jobs.filter(j => !j.is_playlist || !j.songs || j.songs.length === 0);

  if (playlistJobs.length === 0 && singleJobs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-border mb-3">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <h3 className="font-display font-medium text-text/60 text-lg">No hay descargas</h3>
        <p className="text-text-muted mt-1">Pega enlaces de YouTube Music arriba para empezar</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Playlist/Album section */}
      {playlistJobs.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded bg-action/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-action">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display font-semibold text-text">Playlists y Álbumes</h2>
              <p className="text-text-muted text-sm font-mono">{playlistJobs.length} playlist{playlistJobs.length > 1 ? 's' : ''} detectada{playlistJobs.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-2">
            {playlistJobs.map((job) => (
              <JobItem
                key={job.id}
                job={job}
                onCancel={onCancel}
                onRetry={onRetry}
                onOpenFolder={onOpenFolder}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* Single videos/songs section */}
      {singleJobs.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10 8 16 12 10 16 10 8"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display font-semibold text-text">Canciones y Videos</h2>
              <p className="text-text-muted text-sm font-mono">{singleJobs.length} elemento{singleJobs.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-2">
            {singleJobs.map((job) => (
              <JobItem
                key={job.id}
                job={job}
                onCancel={onCancel}
                onRetry={onRetry}
                onOpenFolder={onOpenFolder}
              />
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
