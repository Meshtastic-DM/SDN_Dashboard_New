import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeAdminActivity } from '@/hooks/adminActivity';

const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

export interface MeshtasticConnectionStatus {
  connected: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  message: string;
  port: string | null;
  nodeId: string | null;
}

function normalizeStatus(data: Partial<MeshtasticConnectionStatus>): MeshtasticConnectionStatus {
  return {
    connected: Boolean(data.connected),
    status: data.status || (data.connected ? 'connected' : 'disconnected'),
    message: data.message || (data.connected ? 'Meshtastic device connected' : 'Meshtastic device is not connected.'),
    port: data.port || null,
    nodeId: data.nodeId || null,
  };
}

export function useMeshtasticConnectionStatus() {
  const [status, setStatus] = useState<MeshtasticConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminPollingPaused, setAdminPollingPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/meshtastic/status`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Meshtastic status: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(normalizeStatus(data));
    } catch (err) {
      setStatus({
        connected: false,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unable to read Meshtastic connection status.',
        port: null,
        nodeId: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connectWebSocket = () => {
      if (cancelled || adminPollingPaused) {
        return;
      }

      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const ws = new WebSocket(`${WS_BASE_URL}/api/meshtastic/ws/status`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          setStatus(normalizeStatus(JSON.parse(event.data)));
          setLoading(false);
        } catch (err) {
          console.error('Error parsing Meshtastic status WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        fetchStatus();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        if (!cancelled && !adminPollingPaused) {
          reconnectTimerRef.current = window.setTimeout(connectWebSocket, 3000);
        }
      };
    };

    connectWebSocket();

    return () => {
      cancelled = true;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [adminPollingPaused, fetchStatus]);

  useEffect(() => subscribeAdminActivity(setAdminPollingPaused), []);

  useEffect(() => {
    if (adminPollingPaused) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    fetchStatus();
  }, [adminPollingPaused, fetchStatus]);

  return {
    status,
    loading,
    refetchStatus: fetchStatus,
  };
}
