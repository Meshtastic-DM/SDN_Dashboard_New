import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = 'http://localhost:8000';

export interface MeshtasticConnectionStatus {
  connected: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  message: string;
  port: string | null;
  nodeId: string | null;
}

export function useMeshtasticConnectionStatus(pollIntervalMs = 3000) {
  const [status, setStatus] = useState<MeshtasticConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/meshtastic/status`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Meshtastic status: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus({
        connected: Boolean(data.connected),
        status: data.status || (data.connected ? 'connected' : 'disconnected'),
        message: data.message || (data.connected ? 'Meshtastic device connected' : 'Meshtastic device is not connected.'),
        port: data.port || null,
        nodeId: data.nodeId || null,
      });
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
    fetchStatus();

    const timer = window.setInterval(fetchStatus, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [fetchStatus, pollIntervalMs]);

  return {
    status,
    loading,
    refetchStatus: fetchStatus,
  };
}
