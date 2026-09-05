import type { Job, CreateJobRequest, CreateJobResponse } from '../types/api';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  createJobs: (data: CreateJobRequest) =>
    fetchJson<CreateJobResponse>('/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listJobs: () => fetchJson<Job[]>('/jobs'),

  getJob: (id: string) => fetchJson<Job>(`/jobs/${id}`),

  cancelJob: (id: string) =>
    fetchJson<{ ok: boolean }>(`/jobs/${id}`, { method: 'DELETE' }),

  clearFinished: () =>
    fetchJson<{ ok: boolean; cleared: number }>('/jobs/clear', { method: 'POST' }),

  health: () => fetchJson<{ status: string }>('/health'),
};