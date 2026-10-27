export function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec) return '';
  const kb = bytesPerSec / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB/s`;
  return `${(kb / 1024).toFixed(1)} MB/s`;
}

export function formatEta(seconds?: number): string {
  if (!seconds || seconds < 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
