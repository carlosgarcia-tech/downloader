import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import type { Toast, ToastType, LogEntry } from '../types/api';

interface ToastContextType {
  toasts: Toast[];
  showToast: (_type: ToastType, _message: string, _duration?: number) => string;
  dismissToast: (_id: string) => void;
  clearToasts: () => void;
  logs: LogEntry[];
  addLog: (_log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const dismissToastRef = useRef<(_id: string) => void>(() => {});

  const dismissToast = useCallback((_id: string) => {
    setToasts(prev => prev.filter(t => t.id !== _id));
  }, []);

  dismissToastRef.current = dismissToast;

  const showToast = useCallback((_type: ToastType, _message: string, _duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: Toast = { id, type: _type, message: _message, duration: _duration };
    setToasts(prev => [...prev, toast]);

    if (_duration > 0) {
      setTimeout(() => dismissToastRef.current(id), _duration);
    }

    return id;
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addLog = useCallback((_log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const entry: LogEntry = {
      ..._log,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
    };
    setLogs(prev => [entry, ...prev].slice(0, 500));
  }, []);

  const value = useMemo(() => ({
    toasts,
    showToast,
    dismissToast: dismissToastRef.current,
    clearToasts,
    logs,
    addLog,
  }), [toasts, logs, addLog, clearToasts, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToastRef.current} />
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLogs() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useLogs must be used within ToastProvider');
  return { logs: context.logs, addLog: context.addLog };
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (_id: string) => void }) {
  if (toasts.length === 0) return null;

  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  };

  const colors = {
    success: 'bg-success-dim border-success/20 text-success',
    error: 'bg-danger-dim border-danger/20 text-danger',
    warning: 'bg-warning-dim border-warning/20 text-warning',
    info: 'bg-surface border-border text-text-muted',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full" role="region" aria-live="polite" aria-label="Notificaciones">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded border backdrop-blur-sm animate-slide-up ${colors[toast.type]}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
          aria-live="polite"
        >
          <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-text font-medium text-sm font-display">{toast.message}</p>
          </div>
          <button
            className="flex-shrink-0 text-text-muted/50 hover:text-text transition-colors p-1"
            onClick={(_e) => { _e.stopPropagation(); onDismiss(toast.id); }}
            aria-label="Cerrar notificación"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
