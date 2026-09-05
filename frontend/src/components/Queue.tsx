'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import type { Job } from '../types/api';
import { PlaylistView } from './PlaylistView';
import { useToast } from '../hooks/useToast.tsx';
import { Loader2, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface QueueProps {
  jobs: Job[];
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

  const handleClear = useCallback(async () => {
    try {
      const result = await api.clearFinished();
      showToast('success', `${result.cleared} elemento${result.cleared > 1 ? 's' : ''} eliminad${result.cleared > 1 ? 'os' : 'o'}`);
    } catch {
      showToast('error', 'No se pudo limpiar la cola');
    }
  }, [showToast]);

  if (jobs.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-16"
      >
        <div className="text-center">
          <Loader2 className="w-16 h-16 mx-auto text-line/50 animate-spin mb-4" />
          <h2 className="font-display font-medium text-text/60 text-xl mb-1">Cola vacía</h2>
          <p className="text-text-muted/50">Pega enlaces de YouTube Music arriba para empezar a descargar</p>
        </div>
      </motion.section>
    );
  }

  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const activeCount = jobs.filter(j => ['starting', 'downloading', 'processing'].includes(j.status)).length;
  const errorCount = jobs.filter(j => j.status === 'error').length;
  const pendingCount = jobs.filter(j => j.status === 'queued').length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Queue Header with stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h2 className="font-display font-semibold text-text">Cola de descargas</h2>
          
          <div className="flex items-center gap-2 flex-wrap">
            {activeCount > 0 && (
              <motion.span
                className="badge-starting flex items-center gap-1.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                {activeCount} activo{activeCount > 1 ? 's' : ''}
              </motion.span>
            )}
            {completedCount > 0 && (
              <motion.span
                className="badge-completed flex items-center gap-1.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              >
                <CheckCircle className="w-3 h-3" />
                {completedCount} listo{completedCount > 1 ? 's' : ''}
              </motion.span>
            )}
            {errorCount > 0 && (
              <motion.span
                className="badge-error flex items-center gap-1.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
              >
                <AlertCircle className="w-3 h-3" />
                {errorCount} error{errorCount > 1 ? 'es' : ''}
              </motion.span>
            )}
            {pendingCount > 0 && (
              <motion.span
                className="badge-queued flex items-center gap-1.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
              >
                <Clock className="w-3 h-3" />
                {pendingCount} en cola
              </motion.span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            disabled={completedCount === 0 && errorCount === 0}
            className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar terminadas
          </button>
        </div>
      </div>

      {/* Job List with animations */}
      <motion.div
        layout
        className="space-y-3"
      >
        <PlaylistView
          jobs={jobs}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onOpenFolder={() => {}}
        />
      </motion.div>
    </motion.section>
  );

  function handleRetry(_id: string) {
    // The backend doesn't have a retry endpoint yet, so we'll show a message
    void _id;
    showToast('info', 'La funcionalidad de reintentar estará disponible pronto');
  }
}