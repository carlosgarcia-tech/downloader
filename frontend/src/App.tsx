import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { api } from './services/api';
import type { Job } from './types/api';
import { Form } from './components/Form';
import { Queue } from './components/Queue';
import { PlaylistPreview } from './components/PlaylistPreview';
import { ToastProvider, useToast } from './hooks/useToast.tsx';
import { useWebSocket } from './hooks/useWebSocket.tsx';
import './index.css';

// Emblema GZWave (recorte del logo completo). Vite sirve los archivos de
// public/ desde la raíz: disponible en dev y en el build de producción.
const LOGO_URL = '/logo-icon.png';
// Lockup completo — emblema + GZWave + tagline — para el hero de bienvenida.
const LOGO_HERO_URL = '/logo-hero.png';

function AppContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const { showToast } = useToast();
  const shouldReduceMotion = !!useReducedMotion();

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

  const hasPreview = jobs.some(j => j.is_playlist && j.songs && j.songs.length > 0);

  const transitionConfig = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-[1300px] mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <motion.header
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionConfig}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
            <div className="flex items-center gap-3">
              {/* El nombre vive en el hero de abajo; el h1 queda para lectores
                  de pantalla / navegación accesible. */}
              <h1 className="sr-only">GZWave</h1>
              <motion.div
                initial={shouldReduceMotion ? { scale: 1 } : { scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(229,9,20,0.4)]"
              >
                <img src={LOGO_URL} alt="GZWave" className="w-11 h-11 object-cover rounded-lg" />
              </motion.div>
            </div>

            {/* Connection status — inline in header */}
            <ConnectionStatus
              connectionState={ws.connectionState}
              onReconnect={ws.reconnect}
              shouldReduceMotion={shouldReduceMotion}
            />
          </div>

          {/* Hero de bienvenida: logo completo (GZ + nombre + tagline).
              mix-blend-screen funde su fondo negro con el bg de la página. */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6"
          >
            <img
              src={LOGO_HERO_URL}
              alt="GZWave — Download / Convert / Enjoy"
              width={640}
              height={640}
              className="w-64 sm:w-80 lg:w-96 max-w-full mix-blend-screen"
            />
          </motion.div>

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

        {/* Main content — strict grid: action left, context right.
            Collapses to a single centered column when there's no playlist
            to preview (the aside would render empty otherwise). */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className={`space-y-6 ${hasPreview ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            <Form />
            <Queue jobs={jobs} />
          </div>
          {hasPreview && (
            <aside className="hidden lg:block lg:col-span-5">
              <PlaylistPreview jobs={jobs} />
            </aside>
          )}
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
