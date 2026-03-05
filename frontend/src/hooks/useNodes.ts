import { useState, useEffect, useCallback, useRef } from 'react';
import { MeshtasticNode, NodeDisplayData, transformNodeData } from '@/types/nodes';

const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

export function useNodes() {
  const [nodes, setNodes] = useState<NodeDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch nodes via REST API (for initial load and manual refresh)
  const fetchNodes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/routeview/loadall/nodes`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch nodes');
      }

      const data: MeshtasticNode[] = await response.json();
      const transformedNodes = data.map(transformNodeData);
      setNodes(transformedNodes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_BASE_URL}/api/routeview/ws/nodes`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected to /ws/nodes');
      setWsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data: MeshtasticNode[] = JSON.parse(event.data);
        const transformedNodes = data.map(transformNodeData);
        setNodes(transformedNodes);
        setLoading(false);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting in 3s...');
      setWsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    return ws;
  }, []);

  useEffect(() => {
    // Initial fetch via REST API (for browser refresh/first load)
    fetchNodes();

    // Connect WebSocket for real-time updates
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return { nodes, loading, error, wsConnected, refetch: fetchNodes };
}
