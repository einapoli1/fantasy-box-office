import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '../lib/api';

type Status = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useWebSocket(path: string, onMessage: (data: any) => void) {
  const [status, setStatus] = useState<Status>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const url = getWsUrl(path);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => setStatus('connected');
    ws.onmessage = (e) => {
      try { onMessageRef.current(JSON.parse(e.data)); } catch {}
    };
    ws.onclose = () => {
      setStatus('reconnecting');
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  }, [path]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, send };
}
