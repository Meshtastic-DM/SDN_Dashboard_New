import { useState, useEffect, useMemo, useRef } from 'react';
import { Send, MessageSquare, User, CheckCheck, Check, Clock, Signal } from 'lucide-react';
import { useNodesContext } from '@/contexts/NodesContext';
import { useMessagesContext } from '@/contexts/MessagesContext';
import { Message } from '@/types/message';

export default function MessagesView() {
  const { nodes } = useNodesContext();
  const { messages, loading, error, wsConnected, sendMessage } = useMessagesContext();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to normalize hex IDs (remove 0x prefix, lowercase)
  const normalizeId = (id: string | null): string => {
    if (!id) return '';
    // Remove common prefixes: 0x, !, 0000, and lowercase
    return id.toLowerCase()
      .replace(/^0x/, '')
      .replace(/^!/, '');
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedNodeId]);

  // Detect local node ID from messages where sent_by_me is true
  const localNodeId = useMemo(() => {
    const sentMessage = messages.find(msg => msg.sent_by_me === true);
    return sentMessage?.source_id || null;
  }, [messages]);

  // Get conversations grouped by node
  const conversations = useMemo(() => {
    const conversationMap = new Map<string, {
      nodeId: string;
      nodeName: string;
      lastMessage: Message | null;
      messages: Message[];
    }>();

    // Create a map of normalized IDs to node info for quick lookup
    const nodeMap = new Map<string, typeof nodes[0]>();
    nodes.forEach(node => {
      const normalizedId = normalizeId(node.id);
      nodeMap.set(normalizedId, node);
    });

    // Show all nodes initially, even without messages
    const normalizedLocalId = normalizeId(localNodeId);
    nodes.forEach(node => {
      const normalizedNodeId = normalizeId(node.id);
      if (normalizedNodeId !== normalizedLocalId) { // Don't show local node in list
        conversationMap.set(normalizedNodeId, {
          nodeId: node.id, // Keep original format for display
          nodeName: node.name || node.id,
          lastMessage: null,
          messages: [],
        });
      }
    });

    // Add messages to conversations
    messages.forEach(message => {
      // Skip messages with null IDs
      if (!message.source_id || !message.destination_id) return;
      
      const otherNodeId = message.sent_by_me ? message.destination_id : message.source_id;
      
      // Skip if it's a message to/from self or null
      if (!otherNodeId) return;
      
      const normalizedOtherId = normalizeId(otherNodeId);
      const normalizedLocalId = normalizeId(localNodeId);
      
      if (normalizedOtherId === normalizedLocalId) return;

      if (!conversationMap.has(normalizedOtherId)) {
        // Node not in list (maybe deleted/new), try to find the node info
        const nodeInfo = nodeMap.get(normalizedOtherId);
        conversationMap.set(normalizedOtherId, {
          nodeId: nodeInfo?.id || otherNodeId,
          nodeName: nodeInfo?.name || otherNodeId,
          lastMessage: message,
          messages: [message],
        });
      } else {
        const conv = conversationMap.get(normalizedOtherId)!;
        conv.messages.push(message);
        
        // Update last message if this one is newer
        if (!conv.lastMessage || 
            new Date(message.timestamp) > new Date(conv.lastMessage.timestamp)) {
          conv.lastMessage = message;
        }
      }
    });

    return Array.from(conversationMap.values())
      .sort((a, b) => {
        // Sort by last message time, nulls at the end
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.timestamp).getTime() - 
               new Date(a.lastMessage.timestamp).getTime();
      });
  }, [messages, nodes, localNodeId]);

  // Get messages for selected conversation
  const currentMessages = useMemo(() => {
    if (!selectedNodeId) return [];
    
    const normalizedSelectedId = normalizeId(selectedNodeId);
    const conversation = conversations.find(c => normalizeId(c.nodeId) === normalizedSelectedId);
    return conversation?.messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ) || [];
  }, [selectedNodeId, conversations]);

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedNodeId && conversations.length > 0) {
      setSelectedNodeId(conversations[0].nodeId);
    }
  }, [conversations, selectedNodeId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedNodeId || sending) return;

    try {
      setSending(true);
      // Backend expects format like "6c7428d0" (no 0x prefix)
      const cleanId = selectedNodeId.replace(/^0x/, '');
      await sendMessage(cleanId, messageText.trim());
      setMessageText('');
    } catch (err) {
      console.error('Failed to send message:', err);
      alert(`Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getAckStatusIcon = (ackStatus: number, sentByMe: boolean) => {
    if (!sentByMe) return null;
    
    switch (ackStatus) {
      case 1: // ACKED (Delivered)
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 0: // Pending/Sent
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case -1: // NAKED (Failed/Error)
        return <Check className="h-3 w-3 text-red-500" />;
      default: // Unknown
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-full flex rounded-lg border border-border overflow-hidden bg-card">
      {/* Left Panel - Conversations List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-border">
          <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>CONVERSATIONS</span>
            {localNodeId && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                YOU: {localNodeId}
              </span>
            )}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {wsConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No nodes available
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.nodeId}
                onClick={() => setSelectedNodeId(conv.nodeId)}
                className={`p-3 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedNodeId === conv.nodeId ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-card-foreground truncate">
                      {conv.nodeName}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                      {formatLastMessageTime(conv.lastMessage.timestamp)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <div className="mt-1 text-[11px] text-muted-foreground truncate ml-6">
                    {conv.lastMessage.sent_by_me ? 'You: ' : ''}
                    {conv.lastMessage.text}
                  </div>
                )}
                {!conv.lastMessage && (
                  <div className="mt-1 text-[11px] text-muted-foreground/50 italic ml-6">
                    No messages yet
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col">
        {selectedNodeId ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-card-foreground">
                    {selectedNode?.name || selectedNodeId}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Node ID: {selectedNodeId}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {currentMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No messages yet. Start a conversation!
                </div>
              ) : (
                currentMessages.map((msg) => (
                  <div
                    key={msg.mes_id}
                    className={`flex ${msg.sent_by_me ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 ${
                        msg.sent_by_me
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-accent text-accent-foreground'
                      }`}
                    >
                      <div className="text-sm break-words">{msg.text}</div>
                      
                      {/* Message metadata */}
                      <div className="flex items-center gap-2 mt-1 text-[10px] opacity-70">
                        <span>{formatTime(msg.timestamp)}</span>
                        
                        {msg.rssi !== null && (
                          <span className="flex items-center gap-0.5">
                            <Signal className="h-2.5 w-2.5" />
                            {msg.rssi}dBm
                          </span>
                        )}
                        
                        {msg.channel !== null && (
                          <span>Ch{msg.channel}</span>
                        )}
                        
                        {getAckStatusIcon(msg.ack_status, msg.sent_by_me)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              {error && (
                <div className="mb-2 text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  disabled={sending}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sending}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {sending ? 'Sending...' : 'Send'}
                  </span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
