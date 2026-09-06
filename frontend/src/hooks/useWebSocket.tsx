import { useEffect, useRef, useState, useCallback } from 'react';
import type { Job } from '../types/api';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketOptions {
  onJobsUpdate: (_jobs: Job[]) => void;
  enabled?: boolean;
}

export function useWebSocket({ onJobsUpdate, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const onJobsUpdateRef = useRef(onJobsUpdate);
  useEffect(() => {
    onJobsUpdateRef.current = onJobsUpdate;
  }, [onJobsUpdate]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected, skipping');
      return;
    }

    setConnectionState((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws`;
    console.log('[WS] Connecting to', url);

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnectionState('connected');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const jobs = JSON.parse(event.data) as Job[];
        console.log('[WS] Received', jobs.length, 'jobs');
        onJobsUpdateRef.current(jobs);
      } catch (err) {
        console.error('[WS] Error parsing message:', err, event.data);
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected, code:', event.code, 'reason:', event.reason);
      wsRef.current = null;

      if (reconnectAttempts.current < maxReconnectAttempts) {
        setConnectionState('reconnecting');
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
        reconnectTimeoutRef.current = window.setTimeout(connect, delay);
      } else {
        console.log('[WS] Max reconnect attempts reached');
        setConnectionState('disconnected');
      }
    };

    ws.onerror = (event) => {
      console.error('[WS] Error:', event);
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    console.log('[WS] Disconnecting');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return { connectionState, reconnect: connect };
}
