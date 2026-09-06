import type { Job, CreateJobRequest, CreateJobResponse } from '../types/api';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  console.log(`[API] ${method} ${API_BASE}${url}`, options?.body ? JSON.parse(options.body as string) : '');

  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error desconocido' }));
    console.error(`[API] ${method} ${url} failed: ${response.status}`, error);
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json();
  console.log(`[API] ${method} ${url} OK`, Array.isArray(data) ? `${data.length} items` : data);
  return data;
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
