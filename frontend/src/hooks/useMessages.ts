import { useState, useEffect, useRef } from 'react';
import { Message } from '@/types/message';

interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  sendMessage: (destinationId: string, text: string) => Promise<void>;
  refetchMessages: () => Promise<void>;
}

const WS_BASE_URL = 'ws://localhost:8000';
const API_BASE_URL = 'http://localhost:8000';

export function useMessages(shouldConnect: boolean = false): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Function to fetch messages from REST API
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/texting/all_messages`);
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }
      const data = await response.json();
      // Backend returns { status: "success", messages: [...] }
      const messages = data.messages || [];
      setMessages(messages);
      setError(null);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial messages from REST API
  useEffect(() => {
    fetchMessages();
  }, []);

  // WebSocket connection (conditional based on shouldConnect)
  useEffect(() => {
    if (!shouldConnect) {
      // Clean up if we shouldn't connect
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    const connectWebSocket = () => {
      // Don't create a new connection if one already exists and is open/connecting
      if (wsRef.current && 
          (wsRef.current.readyState === WebSocket.OPEN || 
           wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const ws = new WebSocket(`${WS_BASE_URL}/api/texting/ws/texts`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const rawMessage = JSON.parse(event.data);
          
          // Transform backend format to frontend format
          const message: Message = {
            mes_id: rawMessage.id || rawMessage.mes_id,
            source_id: rawMessage.source || rawMessage.source_id,
            destination_id: rawMessage.destination || rawMessage.destination_id,
            text: rawMessage.text,
            timestamp: typeof rawMessage.timestamp === 'number' 
              ? new Date(rawMessage.timestamp * 1000).toISOString() 
              : rawMessage.timestamp,
            rssi: rawMessage.rssi,
            channel: rawMessage.channel,
            conversation: rawMessage.conversation,
            sent_by_me: rawMessage.sent_by_me || false,
            ack_status: typeof rawMessage.ack_status === 'string'
              ? (rawMessage.ack_status === 'ACKED' ? 1 : rawMessage.ack_status === 'NAKED' ? -1 : 0)
              : (rawMessage.ack_status || 0),
            ack_timestamp: rawMessage.ack_timestamp 
              ? (typeof rawMessage.ack_timestamp === 'number' 
                  ? new Date(rawMessage.ack_timestamp * 1000).toISOString() 
                  : rawMessage.ack_timestamp)
              : null
          };
          
          // Check if this message already exists (for ACK updates)
          setMessages(prev => {
            const existingIndex = prev.findIndex(
              m => m.mes_id === message.mes_id
            );
            
            if (existingIndex !== -1) {
              // Update existing message (ACK status change or filling in source_id)
              const updated = [...prev];
              updated[existingIndex] = message;
              return updated;
            } else {
              // Add new message
              return [...prev, message];
            }
          });
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('Messages WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 3 seconds if we should still be connected
        if (shouldConnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      };
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [shouldConnect]);

  // Function to send a message
  const sendMessage = async (destinationId: string, text: string) => {
    // Generate temporary ID for optimistic update
    const tempId = Date.now();
    
    // Optimistically add message to UI immediately
    const optimisticMessage: Message = {
      mes_id: tempId,
      source_id: null,
      destination_id: destinationId.startsWith('0x') ? destinationId : `0x${destinationId}`,
      text: text,
      timestamp: new Date().toISOString(),
      rssi: null,
      channel: null,
      conversation: destinationId.startsWith('0x') ? destinationId : `0x${destinationId}`,
      sent_by_me: true,
      ack_status: 0,
      ack_timestamp: null
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      // Backend expects 'destination' and 'text' parameters
      const url = `${API_BASE_URL}/api/texting/send?destination=${encodeURIComponent(destinationId)}&text=${encodeURIComponent(text)}`;

      const response = await fetch(url, {
        method: 'POST',
      });

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.mes_id !== tempId));
        
        let errorMessage = `Failed to send message: ${response.statusText}`;
        try {
          const errorData = await response.json();
          // Extract detail from error response
          if (errorData.detail) {
            // detail might be a string or an array of validation errors
            if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ');
            } else {
              errorMessage = JSON.stringify(errorData.detail);
            }
          }
        } catch (parseErr) {
          // If JSON parsing fails, use the statusText
          console.error('Failed to parse error response:', parseErr);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Replace optimistic message with real one when WebSocket broadcasts it
      // The WebSocket handler will update it with the real mes_id
      if (result.mes_id) {
        setMessages(prev => prev.map(m => 
          m.mes_id === tempId ? { ...m, mes_id: result.mes_id } : m
        ));
      }
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  };

  return {
    messages,
    loading,
    error,
    wsConnected,
    sendMessage,
    refetchMessages: fetchMessages,
  };
}
