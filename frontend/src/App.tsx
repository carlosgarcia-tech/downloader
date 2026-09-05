'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from './services/api';
import type { Job } from './types/api';
import { Form } from './components/Form';
import { Queue } from './components/Queue';
import { ToastProvider, useToast } from './hooks/useToast.tsx';
import { useWebSocket, type UseWebSocketOptions } from './hooks/useWebSocket';
import { Loader2, Music, Sparkles } from 'lucide-react';
import './index.css';

function AppContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const { showToast } = useToast();

  const handleJobsUpdate = useCallback((newJobs: Job[]) => {
    setJobs(newJobs);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.listJobs();
      setJobs(data);
    } catch {
      showToast('error', 'No se pudo cargar la cola');
    }
  }, [showToast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useWebSocket({
    onJobsUpdate: handleJobsUpdate,
    enabled: true,
  } satisfies UseWebSocketOptions);

  const handleJobsCreated = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Animated background particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      </div>

      <main className="relative max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/25"
              >
                <Music className="w-8 h-8 text-[#1b1204]" />
              </motion.div>
              <div>
                <h1 className="font-display font-bold text-3xl sm:text-4xl text-text tracking-tight">
                  Descargador
                </h1>
                <p className="text-text-muted/70 mt-1">
                  YouTube & YouTube Music — canciones, álbumes, playlists y videos
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-panel/50 border border-line/50 rounded-full">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-text">Nueva UI</span>
              </div>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-text-muted/60 max-w-2xl"
          >
            Pega enlaces de YouTube / YouTube Music — videos, canciones, álbumes o playlists completas.
            Detectamos automáticamente playlists y álbumes para mostrar el progreso canción por canción.
          </motion.p>
        </motion.header>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-8"
        >
          {/* Form */}
          <Form onJobsCreated={handleJobsCreated} />

          {/* Queue */}
          <Queue jobs={jobs} />
        </motion.div>
      </main>

      {/* Connection status indicator */}
      <ConnectionStatus connectionState="connected" onReconnect={() => {}} />
    </div>
  );
}

interface ConnectionStatusProps {
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  onReconnect: () => void;
}

function ConnectionStatus({ connectionState, onReconnect }: ConnectionStatusProps) {
  if (connectionState === 'disconnected') return null;

  const statusConfig = {
    connecting: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-amber-400', text: 'Conectando...' },
    connected: { icon: null, color: 'text-green-400', text: 'Conectado' },
    reconnecting: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-amber-400', text: 'Reconectando...' },
  };

  const config = statusConfig[connectionState];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 left-6 z-40"
    >
      <div className={`flex items-center gap-2 px-3 py-2 rounded-full bg-panel/90 backdrop-blur-sm border border-line/50 text-sm font-medium ${config.color}`}>
        {config.icon}
        <span className="font-mono">{config.text}</span>
        {connectionState === 'reconnecting' && (
          <motion.button
            onClick={onReconnect}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="ml-2 px-2 py-1 text-xs bg-panel-raised border border-line rounded hover:bg-panel"
          >
            Reintentar ahora
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