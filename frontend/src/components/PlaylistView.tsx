'use client';

import { motion } from 'framer-motion';
import type { Job } from '../types/api';
import { Music, ListMusic } from 'lucide-react';
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
        className="text-center py-16"
      >
        <ListMusic className="w-16 h-16 mx-auto text-line mb-4" />
        <h3 className="text-text/60 font-medium text-lg">No hay descargas</h3>
        <p className="text-text-muted/50 mt-1">Pega enlaces de YouTube Music arriba para empezar</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Playlist/Album section */}
      {playlistJobs.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-teal-500/20 flex items-center justify-center">
              <ListMusic className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-text">Playlists y Álbumes</h2>
              <p className="text-text-muted/70 text-sm">{playlistJobs.length} playlist{playlistJobs.length > 1 ? 's' : ''} detectada{playlistJobs.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-3">
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-panel-raised/50 border border-line/50 flex items-center justify-center">
              <Music className="w-5 h-5 text-text-muted" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-text">Canciones y Videos</h2>
              <p className="text-text-muted/70 text-sm">{singleJobs.length} elemento{singleJobs.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-3">
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