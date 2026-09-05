import { useState, useRef, useCallback, FormEvent, DragEvent, ChangeEvent } from 'react';
import { api } from '../services/api';
import type { CreateJobRequest, DownloadMode, AudioFormat, VideoQuality } from '../types/api';
import { useToast } from '../hooks/useToast';

const AUDIO_FORMATS: AudioFormat[] = ['mp3', 'm4a', 'flac'];
const AUDIO_QUALITIES = ['320', '256', '192', '128'];
const VIDEO_QUALITIES: VideoQuality[] = ['best', '2160', '1440', '1080', '720', '480'];

export function Form({ onJobsCreated }: { onJobsCreated: () => void }) {
  const { showToast } = useToast();
  const urlsRef = useRef<HTMLTextAreaElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [formData, setFormData] = useState<CreateJobRequest>({
    urls: '',
    mode: 'audio',
    audio_format: 'mp3',
    audio_quality: '320',
    video_quality: 'best',
    folder: '',
  });

  const handleModeChange = useCallback((mode: DownloadMode) => {
    setFormData((prev) => ({ ...prev, mode }));
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setFormData((prev) => ({
          ...prev,
          urls: prev.urls ? `${prev.urls}\n${text.trim()}` : text.trim(),
        }));
        showToast('success', 'Enlaces pegados desde el portapapeles');
      }
    } catch {
      showToast('error', 'No se pudo acceder al portapapeles');
    }
  }, [showToast]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const text = e.dataTransfer.getData('text/plain');
    if (text.trim()) {
      setFormData((prev) => ({
        ...prev,
        urls: prev.urls ? `${prev.urls}\n${text.trim()}` : text.trim(),
      }));
      showToast('success', 'Enlaces agregados');
    }
  }, [showToast]);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.urls.trim()) {
      showToast('warning', 'Por favor ingresa al menos un enlace');
      return;
    }

    // Validate URLs
    const urls = formData.urls.split('\n').map(u => u.trim()).filter(Boolean);
    const invalidUrls = urls.filter(u => {
      try {
        const url = new URL(u);
        return !['youtube.com', 'youtu.be', 'music.youtube.com', 'www.youtube.com', 'm.youtube.com']
          .some(domain => url.hostname.endsWith(domain));
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      showToast('error', `URLs no válidas: ${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`);
      return;
    }

    setIsSubmitting(true);
    const submitBtn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (submitBtn) submitBtn.disabled = true;

    try {
      await api.createJobs(formData);
      setFormData((prev) => ({ ...prev, urls: '' }));
      showToast('success', `${urls.length} enlace${urls.length > 1 ? 's' : ''} encolado${urls.length > 1 ? 's' : ''}`);
      onJobsCreated();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error al encolar descargas');
    } finally {
      setIsSubmitting(false);
      if (submitBtn) submitBtn.disabled = false;
    }
  }, [formData.urls, onJobsCreated, showToast]);

  return (
    <form className="slot" onSubmit={handleSubmit}>
      <div className="urls-input-wrapper">
        <label htmlFor="urls" className="slot-label">Enlaces</label>
        <div
          className={`urls-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            ref={urlsRef}
            id="urls"
            name="urls"
            placeholder="https://music.youtube.com/playlist?list=...
https://youtube.com/watch?v=...
(uno por línea)"
            rows={3}
            value={formData.urls}
            onChange={handleChange}
            required
          />
          <div className="urls-actions">
            <button
              type="button"
              className="paste-btn"
              onClick={handlePaste}
              disabled={isSubmitting}
              aria-label="Pegar del portapapeles"
            >
              📋 Pegar
            </button>
          </div>
        </div>
      </div>

      <div className="mode-row">
        <div className="mode-toggle" role="radiogroup" aria-label="Modo de descarga">
          {['audio', 'video'].map((mode) => (
            <button
              key={mode}
              type="button"
              className={`mode-btn ${formData.mode === mode ? 'active' : ''}`}
              onClick={() => handleModeChange(mode as DownloadMode)}
              role="radio"
              aria-checked={formData.mode === mode}
            >
              {mode === 'audio' ? '🎵 Audio' : '🎬 Video'}
            </button>
          ))}
        </div>

        <div className="opt-group" id="audio-opts" hidden={formData.mode !== 'audio'}>
          <select name="audio_format" value={formData.audio_format} onChange={handleChange} aria-label="Formato de audio">
            {AUDIO_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
            ))}
          </select>
          <select name="audio_quality" value={formData.audio_quality} onChange={handleChange} aria-label="Calidad de audio">
            {AUDIO_QUALITIES.map((q) => (
              <option key={q} value={q}>{q} kbps</option>
            ))}
          </select>
        </div>

        <div className="opt-group" id="video-opts" hidden={formData.mode !== 'video'}>
          <select name="video_quality" value={formData.video_quality} onChange={handleChange} aria-label="Calidad de video">
            {VIDEO_QUALITIES.map((q) => (
              <option key={q} value={q}>{q === 'best' ? 'Mejor calidad' : `${q}p`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="folder-row">
        <label htmlFor="folder" className="folder-label">Subcarpeta (opcional)</label>
        <input
          type="text"
          id="folder"
          name="folder"
          placeholder="ej. cumbias, ost-pelicula..."
          value={formData.folder}
          onChange={handleChange}
        />
      </div>

      <button
        type="submit"
        className="submit-btn"
        disabled={isSubmitting || !formData.urls.trim()}
      >
        {isSubmitting ? 'Encolando...' : 'Descargar'}
      </button>
    </form>
  );
}