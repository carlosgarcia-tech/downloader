'use client';

import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import type { Job } from '../types/api';
import { JobItem } from './JobItem';
import { useToast } from '../hooks/useToast.tsx';

interface QueueProps {
  jobs: Job[];
}

function buildBreakdown(jobs: Job[]): string {
  const audioCount = jobs.filter(j => j.mode === 'audio').length;
  const videoCount = jobs.filter(j => j.mode === 'video').length;
  const parts: string[] = [];
  if (audioCount > 0) parts.push(`${audioCount} cancion${audioCount > 1 ? 'es' : ''}`);
  if (videoCount > 0) parts.push(`${videoCount} video${videoCount > 1 ? 's' : ''}`);
  return parts.join(' · ') || `${jobs.length} elemento${jobs.length > 1 ? 's' : ''}`;
}

export function Queue({ jobs }: QueueProps) {
  const { showToast } = useToast();

  const handleCancel = useCallback(async (id: string) => {
    try {
      await api.cancelJob(id);
      showToast('info', 'Descarga cancelada');
    } catch {
      showToast('error', 'No se pudo cancelar la descarga');
    }
  }, [showToast]);

  const handleRetry = useCallback(() => {
    showToast('info', 'La funcionalidad de reintentar estará disponible pronto');
  }, [showToast]);

  const handleClear = useCallback(async () => {
    try {
      const result = await api.clearFinished();
      showToast('success', `${result.cleared} elemento${result.cleared > 1 ? 's' : ''} eliminado${result.cleared > 1 ? 's' : ''}`);
    } catch {
      showToast('error', 'No se pudo limpiar la cola');
    }
  }, [showToast]);

  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const activeCount = jobs.filter(j => ['starting', 'downloading', 'processing'].includes(j.status)).length;
  const errorCount = jobs.filter(j => j.status === 'error').length;
  const pendingCount = jobs.filter(j => j.status === 'queued').length;

  const breakdown = useMemo(() => buildBreakdown(jobs), [jobs]);

  if (jobs.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-12"
      >
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-border mb-3">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.4"/>
            <polygon points="10 8 16 12 10 16 10 8"/>
          </svg>
          <h2 className="font-display font-medium text-text/60 text-xl mb-1">Cola vacía</h2>
          <p className="text-text-muted">Pega enlaces de YouTube Music arriba para empezar a descargar</p>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Unified header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display font-semibold text-text text-lg">Cola de descargas</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeCount > 0 && (
                <span className="badge-downloading flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  {activeCount} activ{activeCount > 1 ? 'as' : 'o'}
                </span>
              )}
              {completedCount > 0 && (
                <span className="badge-completed flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {completedCount} list{completedCount > 1 ? 'os' : 'o'}
                </span>
              )}
              {errorCount > 0 && (
                <span className="badge-error flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  {errorCount} error{errorCount > 1 ? 'es' : ''}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="badge-queued flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {pendingCount} en cola
                </span>
              )}
            </div>
          </div>
          <p className="text-text-muted text-sm font-mono mt-0.5">{breakdown}</p>
        </div>

        <button
          onClick={handleClear}
          disabled={completedCount === 0 && errorCount === 0}
          className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Limpiar terminadas
        </button>
      </div>

      {/* Job list */}
      <motion.div layout className="space-y-2">
        {jobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onCancel={handleCancel}
            onRetry={handleRetry}
            onOpenFolder={() => {}}
            queuedIndex={job.status === 'queued' ? jobs.filter(j => j.status === 'queued').indexOf(job) : undefined}
          />
        ))}
      </motion.div>
    </motion.section>
  );
}
