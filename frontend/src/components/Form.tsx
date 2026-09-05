'use client';

import { useState, useRef, useCallback, FormEvent, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import type { CreateJobRequest, DownloadMode, AudioFormat, VideoQuality } from '../types/api';
import { useToast } from '../hooks/useToast.tsx';
import { Loader2, Clipboard, FileText, Music, Video, ExternalLink, Plus, X, CheckCircle } from 'lucide-react';

const AUDIO_FORMATS: AudioFormat[] = ['mp3', 'm4a', 'flac'];
const AUDIO_QUALITIES = ['320', '256', '192', '128'];
const VIDEO_QUALITIES: VideoQuality[] = ['best', '2160', '1440', '1080', '720', '480'];

export function Form({ onJobsCreated }: { onJobsCreated: () => void }) {
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

  const handleModeChange = useCallback((mode: DownloadMode) => {
    setFormData((prev) => ({ ...prev, mode }));
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (name === 'urls') {
      const urls = value.split('\n').map(u => u.trim()).filter(Boolean);
      setUrlCount(urls.length);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const newUrls = text.trim().split('\n').map(u => u.trim()).filter(Boolean);
        setFormData((prev) => ({
          ...prev,
          urls: prev.urls ? `${prev.urls}\n${newUrls.join('\n')}` : newUrls.join('\n'),
        }));
        showToast('success', `${newUrls.length} enlace${newUrls.length > 1 ? 's' : ''} pegado${newUrls.length > 1 ? 's' : ''} del portapapeles`);
      }
    } catch {
      showToast('error', 'No se pudo acceder al portapapeles');
    }
  }, [showToast]);

  const handleDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
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
      showToast('success', `${newUrls.length} enlace${newUrls.length > 1 ? 's' : ''} agregado${newUrls.length > 1 ? 's' : ''}`);
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

    try {
      await api.createJobs(formData);
      setFormData((prev) => ({ ...prev, urls: '' }));
      setUrlCount(0);
      showToast('success', `${urls.length} enlace${urls.length > 1 ? 's' : ''} encolado${urls.length > 1 ? 's' : ''}`);
      onJobsCreated();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error al encolar descargas');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData.urls, onJobsCreated, showToast]);

  const handleClearUrls = useCallback(() => {
    setFormData(prev => ({ ...prev, urls: '' }));
    setUrlCount(0);
  }, []);

  return (
    <form className="card relative overflow-hidden" onSubmit={handleSubmit}>
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-teal-500/5" />
      
      <div className="relative space-y-6">
        {/* URLs Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="urls" className="font-medium text-text flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <span>Enlaces de YouTube / YouTube Music</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePaste}
                disabled={isSubmitting}
                className="btn-ghost px-3 py-2 text-sm flex items-center gap-2 group"
              >
                <Clipboard className="w-4 h-4" />
                <span>Pegar</span>
              </button>
              {formData.urls && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleClearUrls}
                  disabled={isSubmitting}
                  className="btn-ghost px-3 py-2 text-sm flex items-center gap-1.5 text-text-muted hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                  <span>Limpiar</span>
                </motion.button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {urlCount > 0 && (
              <motion.div
                key="url-count"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between px-3 py-2 bg-panel-raised/50 rounded-lg border border-line/50"
              >
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>{urlCount} enlace{urlCount > 1 ? 's' : ''} detectado{urlCount > 1 ? 's' : ''}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-text-muted/50" />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={cn(
              'relative',
              dragOver && 'ring-2 ring-amber-500/50 bg-amber-500/5 border-amber-500/30'
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
            <textarea
              ref={urlsRef}
              id="urls"
              name="urls"
              placeholder="https://music.youtube.com/playlist?list=...\nhttps://youtube.com/watch?v=...\n(uno por línea)"
              rows={4}
              value={formData.urls}
              onChange={handleChange}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              required
              className={cn(
                'input resize-none relative z-10 transition-all duration-300',
                'placeholder:text-text-muted/40',
                'focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500',
                dragOver && 'ring-2 ring-amber-500 bg-amber-500/5'
              )}
            />
            
            <AnimatePresence mode="wait">
              {dragOver && (
                <motion.div
                  key="drop-hint"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-amber-500/10 border-2 border-dashed border-amber-500/50"
                >
                  <div className="flex flex-col items-center gap-2 text-amber-400 px-4">
                    <FileText className="w-12 h-12" />
                    <span className="font-medium">Suelta los enlaces aquí</span>
                    <span className="text-sm text-text-muted">Se detectarán automáticamente playlists y álbumes</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mode Selection */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <label className="font-medium text-text flex items-center gap-2">
            <Music className="w-5 h-5 text-text-muted" />
            <span>Modo de descarga</span>
          </label>
          
          <div className="flex gap-3" role="radiogroup" aria-label="Modo de descarga">
            {['audio', 'video'].map((mode) => (
              <motion.button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode as DownloadMode)}
                role="radio"
                aria-checked={formData.mode === mode}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex-1 flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-300',
                  'relative overflow-hidden',
                  formData.mode === mode
                    ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                    : 'border-line bg-panel/50 hover:border-line-strong hover:bg-panel',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30'
                )}
              >
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300',
                  formData.mode === mode
                    ? (mode === 'audio' ? 'bg-amber-500' : 'bg-teal-500')
                    : 'bg-panel-raised border border-line'
                )}>
                  {mode === 'audio' ? (
                    <Music className={cn('w-7 h-7', formData.mode === mode ? 'text-[#1b1204]' : 'text-text-muted')} />
                  ) : (
                    <Video className={cn('w-7 h-7', formData.mode === mode ? 'text-white' : 'text-text-muted')} />
                  )}
                </div>
                <div className="text-center">
                  <span className={cn(
                    'font-display font-medium text-lg',
                    formData.mode === mode ? 'text-text' : 'text-text-muted'
                  )}>
                    {mode === 'audio' ? 'Audio' : 'Video'}
                  </span>
                  <p className="text-xs text-text-muted/60 mt-1">
                    {mode === 'audio' ? 'MP3, M4A, FLAC' : 'MP4 hasta 4K'}
                  </p>
                </div>
                {formData.mode === mode && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center"
                  >
                    <CheckCircle className="w-4 h-4 text-[#1b1204]" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Options based on mode */}
        <AnimatePresence mode="wait">
          {formData.mode === 'audio' && (
            <motion.div
              key="audio-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <label className="font-medium text-text flex items-center gap-2">
                <Music className="w-5 h-5 text-text-muted" />
                <span>Opciones de audio</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="audio_format" className="block text-sm text-text-muted/70 mb-1.5">Formato</label>
                  <select
                    name="audio_format"
                    id="audio_format"
                    value={formData.audio_format}
                    onChange={handleChange}
                    className="select"
                  >
                    {AUDIO_FORMATS.map((fmt) => (
                      <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="audio_quality" className="block text-sm text-text-muted/70 mb-1.5">Calidad</label>
                  <select
                    name="audio_quality"
                    id="audio_quality"
                    value={formData.audio_quality}
                    onChange={handleChange}
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
              className="space-y-4"
            >
              <label className="font-medium text-text flex items-center gap-2">
                <Video className="w-5 h-5 text-text-muted" />
                <span>Opciones de video</span>
              </label>
              <div>
                <label htmlFor="video_quality" className="block text-sm text-text-muted/70 mb-1.5">Calidad máxima</label>
                <select
                  name="video_quality"
                  id="video_quality"
                  value={formData.video_quality}
                  onChange={handleChange}
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <label htmlFor="folder" className="font-medium text-text flex items-center gap-2">
            <span className="w-5 h-5">📁</span>
            <span>Subcarpeta (opcional)</span>
          </label>
          <input
            type="text"
            id="folder"
            name="folder"
            placeholder="ej. cumbias, ost-pelicula, mi-playlist..."
            value={formData.folder}
            onChange={handleChange}
            className="input"
          />
          <p className="text-xs text-text-muted/60">
            Se creará dentro de la carpeta de descargas. Solo caracteres alfanuméricos, espacios, guiones y puntos.
          </p>
        </motion.div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={isSubmitting || !formData.urls.trim()}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            'btn-primary w-full py-4 text-lg font-display',
            'relative overflow-hidden group',
            !formData.urls.trim() && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className="relative flex items-center justify-center gap-3">
            <AnimatePresence mode="wait">
              {isSubmitting ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  className="flex items-center gap-2"
                >
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Encolando...</span>
                </motion.span>
              ) : (
                <motion.span
                  key="default"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3"
                >
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-[#1b1204]" />
                  </span>
                  <span>Descargar</span>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          
          {/* Shimmer effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </motion.button>
      </div>
    </form>
  );
}