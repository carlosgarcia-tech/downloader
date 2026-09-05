import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import type { Toast, ToastType, LogEntry } from '../types/api';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

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

  // Use ref to avoid circular dependency issues
  const dismissToastRef = useRef<(_id: string) => void>(() => {});

  const dismissToast = useCallback((_id: string) => {
    setToasts(prev => prev.filter(t => t.id !== _id));
  }, []);

  // Update ref after dismissToast is defined
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

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

export function useLogs() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useLogs must be used within ToastProvider');
  return { logs: context.logs, addLog: context.addLog };
}

// Moved ToastContainer to separate component to avoid fast-refresh warning
export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (_id: string) => void }) {
  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info: <Info className="w-5 h-5 text-teal-400" />,
  };

  const colors = {
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    info: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full animate-in" role="region" aria-live="polite" aria-label="Notificaciones">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm animate-slide-in ${colors[toast.type]}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
          aria-live="polite"
        >
          <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-text font-medium text-sm">{toast.message}</p>
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