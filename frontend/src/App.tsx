'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { api } from './services/api';
import type { Job } from './types/api';
import { Form } from './components/Form';
import { Queue } from './components/Queue';
import { ToastProvider, useToast } from './hooks/useToast.tsx';
import { useWebSocket } from './hooks/useWebSocket.tsx';
import './index.css';

function AppContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();

  const handleJobsUpdate = useCallback((newJobs: Job[]) => {
    setJobs(newJobs);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      console.log('[App] Fetching jobs...');
      const data = await api.listJobs();
      console.log('[App] Jobs fetched:', data.length);
      setJobs(data);
    } catch (err) {
      console.error('[App] Failed to fetch jobs:', err);
      showToast('error', 'No se pudo cargar la cola');
    }
  }, [showToast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const ws = useWebSocket({
    onJobsUpdate: handleJobsUpdate,
    enabled: true,
  });

  const transitionConfig = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.16, 1, 0.3, 1] };

  return (
    <div className="min-h-screen bg-bg">
      <main className="relative max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.header
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionConfig}
          className="mb-10"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
            <div className="flex items-center gap-3">
              <motion.div
                initial={shouldReduceMotion ? { scale: 1 } : { scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-action flex items-center justify-center flex-shrink-0"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 sm:w-7 sm:h-7 text-bg">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="10 8 16 12 10 16 10 8"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                </svg>
              </motion.div>
              <div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-text tracking-tight">
                  Descargador
                </h1>
                <p className="text-text-muted mt-0.5 text-xs sm:text-sm">
                  YouTube & YouTube Music
                </p>
              </div>
            </div>

            {/* Connection status — inline in header */}
            <ConnectionStatus
              connectionState={ws.connectionState}
              onReconnect={ws.reconnect}
              shouldReduceMotion={shouldReduceMotion}
            />
          </div>

          <motion.p
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-text-muted max-w-2xl text-sm"
          >
            Pega enlaces de YouTube / YouTube Music — videos, canciones, álbumes o playlists completas.
            <span className="hidden sm:inline"> Detectamos automáticamente playlists y álbumes para mostrar el progreso canción por canción.</span>
          </motion.p>
        </motion.header>

        {/* Main Content */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >
          <Form />
          <Queue jobs={jobs} />
        </motion.div>
      </main>
    </div>
  );
}

function ConnectionStatus({
  connectionState,
  onReconnect,
  shouldReduceMotion,
}: {
  connectionState?: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  onReconnect: () => void;
  shouldReduceMotion: boolean;
}) {
  const statusConfig = {
    connecting: { color: 'text-text-muted', text: 'Conectando...' },
    connected: { color: 'text-success', text: 'Conectado' },
    reconnecting: { color: 'text-text-muted', text: 'Reconectando...' },
  } as const;

  const config = connectionState ? statusConfig[connectionState as keyof typeof statusConfig] : undefined;
  if (!config) return null;

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-mono ${config.color}`}>
        <span className={`w-2 h-2 rounded-full status-dot ${
          connectionState === 'connecting' ? 'connecting' :
          connectionState === 'connected' ? 'connected' :
          connectionState === 'reconnecting' ? 'reconnecting' :
          'disconnected'
        }`} />
        <span>{config.text}</span>
        {connectionState === 'reconnecting' && (
          <motion.button
            onClick={onReconnect}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="ml-1.5 px-2 py-0.5 text-xs bg-surface-raised border border-border rounded hover:bg-surface-raised font-mono"
          >
            Reintentar
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
