import { useEffect, useRef, useState, useCallback } from 'react';
import type { Job, SongProgress } from '../types/api';

export interface UseWebSocketOptions {
  onJobsUpdate: (_jobs: Job[]) => void;
  onJobUpdate?: (_job: Job) => void;
  onSongUpdate?: (_jobId: string, _song: SongProgress) => void;
  enabled?: boolean;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  lastMessageTime: Date | null;
  reconnect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  onJobsUpdate,
  onJobUpdate,
  onSongUpdate,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 15;
  const baseReconnectDelay = 1000;
  const maxReconnectDelay = 30000;
  
  const onJobsUpdateRef = useRef(onJobsUpdate);
  const onJobUpdateRef = useRef(onJobUpdate);
  const onSongUpdateRef = useRef(onSongUpdate);
  const enabledRef = useRef(enabled);

  onJobsUpdateRef.current = onJobsUpdate;
  onJobUpdateRef.current = onJobUpdate;
  onSongUpdateRef.current = onSongUpdate;
  enabledRef.current = enabled;

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('[WS] Disconnecting...');
    clearReconnectTimeout();
    clearHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionState('disconnected');
    reconnectAttempts.current = 0;
  }, [clearReconnectTimeout, clearHeartbeat]);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    console.log('[WS] Starting heartbeat');
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }, [clearHeartbeat]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle heartbeat response
      if (data.type === 'pong') {
        console.log('[WS] Received pong');
        return;
      }
      
      // Handle jobs array update
      if (Array.isArray(data)) {
        const jobs = data as Job[];
        console.log('[WS] Received jobs update:', jobs.length, 'jobs');
        onJobsUpdateRef.current(jobs);
        
        // Also check for individual song updates
        if (onSongUpdateRef.current) {
          jobs.forEach(job => {
            if (job.songs?.length) {
              job.songs.forEach(song => {
                onSongUpdateRef.current?.(job.id, song);
              });
            }
          });
        }
        
        // Check for individual job updates
        if (onJobUpdateRef.current) {
          jobs.forEach(job => {
            onJobUpdateRef.current?.(job);
          });
        }
        
        setLastMessageTime(new Date());
      }
    } catch (err) {
      console.error('Error parsing WS message:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabledRef.current) {
      console.log('[WS] Connect skipped - not enabled');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }
    
    console.log('[WS] Connecting...');
    setConnectionState('connecting');
    
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}/ws`;
    console.log('[WS] Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected successfully');
      setIsConnected(true);
      setConnectionState('connected');
      reconnectAttempts.current = 0;
      startHeartbeat();
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[WS] Connection closed:', event.code, event.reason);
      setIsConnected(false);
      clearHeartbeat();
      wsRef.current = null;
      
      if (!enabledRef.current) {
        setConnectionState('disconnected');
        return;
      }

      if (event.code === 1000) {
        // Clean close
        setConnectionState('disconnected');
        return;
      }

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        setConnectionState('reconnecting');
        const delay = Math.min(
          baseReconnectDelay * Math.pow(2, reconnectAttempts.current) + Math.random() * 1000,
          maxReconnectDelay
        );
        reconnectAttempts.current++;
        
        console.log('[WS] Reconnecting in', delay, 'ms (attempt', reconnectAttempts.current, ')');
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setConnectionState('disconnected');
        console.error('Max reconnection attempts reached');
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      ws.close();
    };

    wsRef.current = ws;
  }, [handleMessage, startHeartbeat, clearHeartbeat]);

  const reconnect = useCallback(() => {
    console.log('[WS] Manual reconnect requested');
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    if (enabled) {
      console.log('[WS] Effect: connecting...');
      connect();
    } else {
      console.log('[WS] Effect: disconnecting...');
      disconnect();
    }

    return () => {
      console.log('[WS] Effect cleanup: disconnecting...');
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    connectionState,
    lastMessageTime,
    reconnect,
    disconnect,
  };
}