import { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import type { Job } from './types/api';
import { Form } from './components/Form';
import { Queue } from './components/Queue';
import { ToastProvider, useToast } from './hooks/useToast.tsx';
import { useWebSocket } from './hooks/useWebSocket.tsx';
import './styles.css';

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

  useWebSocket(handleJobsUpdate);

  const handleJobsCreated = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="deck">
      <header className="deck-header">
        <div className="deck-title">
          <span className="deck-mark" aria-hidden="true" />
          <h1>Descargador</h1>
        </div>
        <p className="deck-sub">
          Pega un enlace de YouTube / YouTube Music — video, canción, álbum o playlist completa.
        </p>
      </header>

      <Form onJobsCreated={handleJobsCreated} />

      <Queue jobs={jobs} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}