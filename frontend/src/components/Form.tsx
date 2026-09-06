'use client';

import { useState, useRef, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import type { CreateJobRequest, AudioFormat, VideoQuality } from '../types/api';
import { useToast } from '../hooks/useToast.tsx';

const AUDIO_FORMATS: AudioFormat[] = ['mp3', 'm4a', 'flac'];
const AUDIO_QUALITIES = ['320', '256', '192', '128'];
const VIDEO_QUALITIES: VideoQuality[] = ['best', '2160', '1440', '1080', '720', '480'];

const PLACEHOLDER_URLS = `https://music.youtube.com/playlist?list=...
https://youtube.com/watch?v=...
(uno por línea)`;

export function Form() {
  const { showToast } = useToast();
  const urlsRef = useRef<HTMLTextAreaElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlCount, setUrlCount] = useState(0);

  const [formData, setFormData] = useState<CreateJobRequest>({
    urls: '',
    mode: 'audio',
    audio_format: 'mp3',
    audio_quality: '320',
    video_quality: 'best',
    folder: '',
  });

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const newUrls = text.trim().split('\n').map(u => u.trim()).filter(Boolean);
        setFormData((prev) => ({
          ...prev,
          urls: prev.urls ? `${prev.urls}\n${newUrls.join('\n')}` : newUrls.join('\n'),
        }));
      }
    } catch {
      // Silently fail - clipboard access denied
    }
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.urls.trim()) {
      return;
    }

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
      showToast('error', 'Alguno de los enlaces no es de YouTube o YouTube Music');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('[Form] Submitting jobs:', urls.length, 'URLs, mode:', formData.mode);
      await api.createJobs(formData);
      console.log('[Form] Jobs created successfully');
      setFormData((prev) => ({ ...prev, urls: '' }));
      setUrlCount(0);
    } catch (err) {
      console.error('[Form] Failed to create jobs:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, showToast]);

  const handleClearUrls = useCallback(() => {
    setFormData((prev) => ({ ...prev, urls: '' }));
    setUrlCount(0);
  }, []);

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* URLs Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="urls" className="font-medium text-text flex items-center gap-2 font-mono text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-action">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              <span>Enlaces de YouTube / YouTube Music</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePaste}
                disabled={isSubmitting}
                className="btn-ghost"
                aria-label="Pegar desde portapapeles"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
                <span>Pegar</span>
              </button>
              {formData.urls && (
                <button
                  type="button"
                  onClick={handleClearUrls}
                  disabled={isSubmitting}
                  className="btn-ghost text-danger hover:text-danger"
                  aria-label="Limpiar enlaces"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          <div
            className={`relative transition-all duration-200 ${
              dragOver
                ? 'ring-1 ring-action bg-action/5 border-action/30'
                : ''
            }`}
          >
            <textarea
              ref={urlsRef}
              id="urls"
              name="urls"
              placeholder={PLACEHOLDER_URLS}
              rows={4}
              value={formData.urls}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, urls: e.target.value }));
                const urls = e.target.value.split('\n').map(u => u.trim()).filter(Boolean);
                setUrlCount(urls.length);
              }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                const text = e.dataTransfer.getData('text/plain');
                if (text.trim()) {
                  const newUrls = text.trim().split('\n').map(u => u.trim()).filter(Boolean);
                  setFormData((prev) => ({
                    ...prev,
                    urls: prev.urls ? `${prev.urls}\n${newUrls.join('\n')}` : newUrls.join('\n'),
                  }));
                }
              }}
              required
              className="input resize-none transition-all duration-200"
            />

            <AnimatePresence mode="wait">
              {dragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg bg-action/5 border border-dashed border-action/30"
                >
                  <div className="flex flex-col items-center gap-2 text-action px-4">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span className="font-medium font-display">Suelta los enlaces aquí</span>
                    <span className="text-text-dim text-xs font-mono">Se detectan playlists y álbumes automáticamente</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {urlCount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-surface-raised rounded-lg border border-border animate-slide-up">
              <div className="flex items-center gap-2 text-sm text-text-muted font-mono">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-action animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span>{urlCount} enlace{urlCount > 1 ? 's' : ''} detectado{urlCount > 1 ? 's' : ''}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </div>
          )}
        </div>

        {/* Mode Selection */}
        <div className="space-y-4">
          <label className="font-medium text-text flex items-center gap-2 font-mono text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
            </svg>
            <span>Modo de descarga</span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3" role="radiogroup" aria-label="Modo de descarga">
            {(['audio', 'video'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, mode }))}
                role="radio"
                aria-checked={formData.mode === mode}
                className={`flex-1 flex flex-col items-center gap-3 p-4 sm:p-5 rounded-lg border-2 transition-all duration-200 relative overflow-hidden ${
                  formData.mode === mode
                    ? mode === 'audio'
                      ? 'border-action ring-1 ring-action/20'
                      : 'border-border-strong ring-1 ring-text/10'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised'
                }`}
              >
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  formData.mode === mode
                    ? mode === 'audio'
                      ? 'border-2 border-action text-action'
                      : 'border-2 border-border-strong text-text'
                    : 'bg-surface-raised border border-border'
                }`}>
                  {mode === 'audio' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={formData.mode === mode ? 'text-action' : 'text-text-muted'}>
                      <circle cx="12" cy="12" r="10"/>
                      <polygon points="10 8 16 12 10 16 10 8"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={formData.mode === mode ? 'text-text' : 'text-text-muted'}>
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2"/>
                    </svg>
                  )}
                </div>
                <div className="text-center">
                  <span className={`font-display font-medium text-lg ${formData.mode === mode ? 'text-text' : 'text-text-muted'}`}>
                    {mode === 'audio' ? 'Audio' : 'Video'}
                  </span>
                  <p className="text-xs text-text-dim mt-1">
                    {mode === 'audio' ? 'MP3, M4A, FLAC' : 'MP4 hasta 4K'}
                  </p>
                </div>
                {formData.mode === mode && (
                  <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                    mode === 'audio' ? 'bg-action' : 'bg-text'
                  }`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#09090b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Options based on mode */}
        <AnimatePresence mode="wait">
          {formData.mode === 'audio' && (
            <motion.div
              key="audio-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <label className="font-medium text-text flex items-center gap-2 font-mono text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="10 8 16 12 10 16 10 8"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                </svg>
                <span>Opciones de audio</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="audio_format" className="block text-sm text-text-muted mb-1.5 font-mono">Formato</label>
                  <select
                    name="audio_format"
                    id="audio_format"
                    value={formData.audio_format}
                    onChange={(e) => setFormData(prev => ({ ...prev, audio_format: e.target.value as AudioFormat }))}
                    className="select"
                  >
                    {AUDIO_FORMATS.map((fmt) => (
                      <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="audio_quality" className="block text-sm text-text-muted mb-1.5 font-mono">Calidad</label>
                  <select
                    name="audio_quality"
                    id="audio_quality"
                    value={formData.audio_quality}
                    onChange={(e) => setFormData(prev => ({ ...prev, audio_quality: e.target.value }))}
                    className="select"
                  >
                    {AUDIO_QUALITIES.map((q) => (
                      <option key={q} value={q}>{q} kbps</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {formData.mode === 'video' && (
            <motion.div
              key="video-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <label className="font-medium text-text flex items-center gap-2 font-mono text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
                <span>Opciones de video</span>
              </label>
              <div>
                <label htmlFor="video_quality" className="block text-sm text-text-muted mb-1.5 font-mono">Calidad máxima</label>
                <select
                  name="video_quality"
                  id="video_quality"
                  value={formData.video_quality}
                  onChange={(e) => setFormData(prev => ({ ...prev, video_quality: e.target.value as VideoQuality }))}
                  className="select max-w-xs"
                >
                  {VIDEO_QUALITIES.map((q) => (
                    <option key={q} value={q}>
                      {q === 'best' ? 'Mejor calidad disponible' : `${q}p`}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Folder */}
        <div className="space-y-2">
          <label htmlFor="folder" className="font-medium text-text flex items-center gap-2 font-mono text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Subcarpeta (opcional)</span>
          </label>
          <input
            type="text"
            id="folder"
            name="folder"
            placeholder="ej. cumbias, ost-pelicula, mi-playlist..."
            value={formData.folder}
            onChange={(e) => setFormData(prev => ({ ...prev, folder: e.target.value }))}
            className="input"
          />
          <p className="text-xs text-text-muted">
            Se creará dentro de la carpeta de descargas. Solo caracteres alfanuméricos, espacios, guiones y puntos.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !formData.urls.trim()}
          className={`btn-primary w-full py-4 text-lg font-display relative overflow-hidden ${
            !formData.urls.trim() ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <span className="relative flex items-center justify-center gap-3">
            <AnimatePresence mode="wait">
              {isSubmitting ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#09090b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  <span>Encolando...</span>
                </motion.span>
              ) : (
                <motion.span
                  key="default"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#09090b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>Descargar</span>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>
      </div>
    </form>
  );
}
