import { useCallback } from 'react';
import { api } from '../services/api';
import type { Job } from '../types/api';
import { JobItem } from './JobItem';
import { useToast } from '../hooks/useToast';

interface QueueProps {
  jobs: Job[];
}

export function Queue({ jobs }: QueueProps) {
  const { showToast } = useToast();

  const handleCancel = useCallback(async (id: string) => {
    try {
      await api.cancelJob(id);
      showToast('info', 'Descarga cancelada');
    } catch (err) {
      showToast('error', 'No se pudo cancelar la descarga');
    }
  }, [showToast]);

  const handleClear = useCallback(async () => {
    try {
      const result = await api.clearFinished();
      showToast('success', `${result.cleared} elementos eliminados`);
    } catch (err) {
      showToast('error', 'No se pudo limpiar la cola');
    }
  }, [showToast]);

  if (jobs.length === 0) {
    return (
      <section className="queue">
        <div className="queue-header">
          <h2>Cola</h2>
          <button type="button" className="clear-btn" onClick={handleClear} disabled>
            Limpiar terminadas
          </button>
        </div>
        <ul className="queue-list">
          <li className="empty-hint">Todavía no hay descargas. Pega un enlace arriba para empezar.</li>
        </ul>
      </section>
    );
  }

  return (
    <section className="queue">
      <div className="queue-header">
        <h2>Cola ({jobs.length})</h2>
        <button type="button" className="clear-btn" onClick={handleClear}>
          Limpiar terminadas
        </button>
      </div>
      <ul className="queue-list">
        {jobs.map((job) => (
          <JobItem key={job.id} job={job} onCancel={handleCancel} />
        ))}
      </ul>
    </section>
  );
}