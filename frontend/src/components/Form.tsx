'use client';

import { useState, useRef, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { DownloadSimple, Link as LinkIcon, MonitorPlay, MusicNote, ArrowCounterClockwise, X } from '@phosphor-icons/react';
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
  const reduced = !!useReducedMotion();
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
      await api.createJobs(formData);
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
    <form className="panel p-5" onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* URLs Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="urls" className="font-bold text-text flex items-center gap-2 text-sm">
              <LinkIcon weight="bold" size={16} className="text-action-strong" />
              <span>Enlaces de YouTube / YouTube Music</span>
            </label>
            {formData.urls && (
              <button
                type="button"
                onClick={handleClearUrls}
                disabled={isSubmitting}
                className="btn-ghost text-danger hover:text-danger"
                aria-label="Limpiar enlaces"
              >
                <X weight="bold" size={15} />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          <div
            className={`relative transition-all duration-200 ${
              dragOver ? 'ring-1 ring-action border border-action/40' : ''
            }`}
          >
            {/* Down receptacle with left icon */}
            <LinkIcon
              weight="bold"
              size={16}
              className="absolute left-3.5 top-3.5 text-text-dim pointer-events-none"
            />
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
              className="input resize-none pl-10 pb-11"
            />

            {/* Integrated paste button — bottom-right of the receptacle */}
            <button
              type="button"
              onClick={handlePaste}
              disabled={isSubmitting}
              className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded border border-border bg-surface-raised text-text-muted hover:text-text hover:border-border-strong transition-colors"
              aria-label="Pegar desde portapapeles"
            >
              <ArrowCounterClockwise weight="bold" size={13} />
              <span>Pegar</span>
            </button>

            <AnimatePresence mode="wait">
              {dragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-md bg-action-dim border border-dashed border-action"
                >
                  <div className="flex flex-col items-center gap-2 text-action-strong px-4">
                    <DownloadSimple weight="fill" size={44} />
                    <span className="font-bold">Suelta los enlaces aquí</span>
                    <span className="text-text-dim text-xs font-mono">Se detectan playlists y álbumes automáticamente</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {urlCount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-surface-raised rounded-lg border border-border animate-slide-up">
              <div className="flex items-center gap-2 text-sm text-text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-action animate-dot-pulse" />
                <span>{urlCount} enlace{urlCount > 1 ? 's' : ''} detectado{urlCount > 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>

        {/* Mode Selection — physical segmented control */}
        <div className="space-y-4">
          <label className="font-bold text-text text-sm">Modo de descarga</label>

          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-input shadow-inset-deep"
            role="radiogroup"
            aria-label="Modo de descarga"
          >
            {(['audio', 'video'] as const).map((mode) => {
              const active = formData.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, mode }))}
                  role="radio"
                  aria-checked={active}
                  className="relative flex items-center justify-center gap-2.5 py-3 rounded-md text-sm font-bold transition-colors duration-150"
                >
                  {active && (
                    <motion.span
                      layoutId="mode-thumb"
                      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                      className="absolute inset-0 rounded-md bg-surface-raised border border-border-strong shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className={`relative flex items-center justify-center gap-2.5 transition-colors duration-150 ${active ? '' : 'text-text-dim hover:text-text-muted'}`}>
                    {mode === 'audio' ? (
                      <MusicNote weight={active ? 'fill' : 'regular'} size={18} className={active ? 'text-action-strong' : ''} />
                    ) : (
                      <MonitorPlay weight={active ? 'fill' : 'regular'} size={18} className={active ? 'text-action-strong' : ''} />
                    )}
                    <span className={active ? 'text-text' : ''}>{mode === 'audio' ? 'Audio' : 'Video'}</span>
                    <span className="text-[10px] font-mono font-normal text-text-dim hidden sm:inline">
                      {mode === 'audio' ? 'MP3 · M4A · FLAC' : 'MP4 hasta 4K'}
                    </span>
                  </span>
                </button>
              );
            })}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="audio_format" className="block text-sm text-text-muted mb-1.5 font-bold">Formato</label>
                  <select
                    name="audio_format"
                    id="audio_format"
                    value={formData.audio_format}
                    onChange={(e) => setFormData(prev => ({ ...prev, audio_format: e.target.value as AudioFormat }))}
                    className="select input w-full"
                  >
                    {AUDIO_FORMATS.map((fmt) => (
                      <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="audio_quality" className="block text-sm text-text-muted mb-1.5 font-bold">Calidad</label>
                  <select
                    name="audio_quality"
                    id="audio_quality"
                    value={formData.audio_quality}
                    onChange={(e) => setFormData(prev => ({ ...prev, audio_quality: e.target.value }))}
                    className="select input w-full"
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
            >
              <div>
                <label htmlFor="video_quality" className="block text-sm text-text-muted mb-1.5 font-bold">Calidad máxima</label>
                <select
                  name="video_quality"
                  id="video_quality"
                  value={formData.video_quality}
                  onChange={(e) => setFormData(prev => ({ ...prev, video_quality: e.target.value as VideoQuality }))}
                  className="select input max-w-xs w-full"
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
          <label htmlFor="folder" className="font-bold text-text text-sm">Subcarpeta (opcional)</label>
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

        {/* Submit Button — massive CTA, carmine gradient, glow, physical press */}
        <button
          type="submit"
          disabled={isSubmitting || !formData.urls.trim()}
          className="btn-primary w-full py-4 text-lg relative overflow-hidden !rounded-lg"
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
                  className="flex items-center gap-2 font-extrabold"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
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
                  className="flex items-center gap-3 font-extrabold"
                >
                  <DownloadSimple weight="bold" size={22} />
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
