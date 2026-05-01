import { useState, useEffect, useMemo, useRef } from 'react';
import { Send, MessageSquare, User, CheckCheck, Check, Clock, Signal, Circle, Radio, Mic, Square, Play } from 'lucide-react';
import { useNodesContext } from '@/contexts/NodesContext';
import { useMessagesContext } from '@/contexts/MessagesContext';
import { Message } from '@/types/message';

const VOICE_PREFIX_PATTERN = /^\s*\[VR\]\s*/i;
const API_BASE_URL = 'http://localhost:8000';

const isVoiceMessage = (text: string) => VOICE_PREFIX_PATTERN.test(text);
const getDisplayText = (text: string) => text.replace(VOICE_PREFIX_PATTERN, '');

const mergeAudioChunks = (chunks: Float32Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
};

const writeString = (view: DataView, offset: number, value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const encodeWav = (samples: Float32Array, sampleRate: number) => {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([view], { type: 'audio/wav' });
};

export default function MessagesView() {
  const { nodes, selfNodeId, selfNodeIdLongName } = useNodesContext();
  const { messages, loading, error, wsConnected, sendMessage } = useMessagesContext();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [draftHasVoiceInput, setDraftHasVoiceInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSelectDoneRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const recordingSampleRateRef = useRef(44100);

  // Helper function to normalize hex IDs (remove 0x prefix, lowercase)
  const normalizeId = (id: string | null): string => {
    if (!id) return '';
    // Remove common prefixes: 0x, !, 0000, and lowercase
    return id.toLowerCase()
      .replace(/^0x/, '')
      .replace(/^!/, '');
  };

  // Helper to check if a message is a broadcast
  const isBroadcastMessage = (msg: Message): boolean => {
    if (!msg.conversation) return false;
    const normalizedConv = normalizeId(msg.conversation);
    return normalizedConv.slice(-8) === 'ffffffff';
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedNodeId]);

  useEffect(() => {
    return () => {
      cleanupRecording();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Get conversations grouped by node
  const conversations = useMemo(() => {
    const conversationMap = new Map<string, {
      nodeId: string;
      nodeName: string;
      lastMessage: Message | null;
      messages: Message[];
      status: string;
    }>();

    // Create a map of normalized IDs to node info for quick lookup
    const nodeMap = new Map<string, typeof nodes[0]>();
    nodes.forEach(node => {
      const normalizedId = normalizeId(node.id);
      nodeMap.set(normalizedId, node);
    });

    // Show all nodes (except self)
    const normalizedSelfId = normalizeId(selfNodeId);
    nodes.forEach(node => {
      const normalizedNodeId = normalizeId(node.id);
      // Include all nodes except the self node (match by last 7 chars)
      const isSelfNode = normalizedSelfId && normalizedNodeId.slice(-7) === normalizedSelfId.slice(-7);
      
      if (!isSelfNode) {
        conversationMap.set(normalizedNodeId, {
          nodeId: node.id, // Keep original format for display
          nodeName: node.name || node.id,
          lastMessage: null,
          messages: [],
          status: node.status,
        });
      }
    });

    // Add messages to conversations (ONLY non-broadcast messages)
    messages.forEach(message => {
      // Skip messages with null IDs
      if (!message.source_id || !message.destination_id) return;
      
      // SKIP broadcast messages - they go ONLY to broadcastMessages
      if (isBroadcastMessage(message)) return;
      
      // Filter: Only show messages where current node is source OR destination
      const normalizedSource = normalizeId(message.source_id);
      const normalizedDest = normalizeId(message.destination_id);
      if (normalizedSelfId) {
        const isSelfSource = normalizedSource.slice(-7) === normalizedSelfId.slice(-7);
        const isSelfDest = normalizedDest.slice(-7) === normalizedSelfId.slice(-7);
        
        // Skip message if current node is neither source nor destination
        if (!isSelfSource && !isSelfDest) {
          return;
        }
      }
      
      const otherNodeId = message.sent_by_me ? message.destination_id : message.source_id;
      
      // Skip if null
      if (!otherNodeId) return;
      
      const normalizedOtherId = normalizeId(otherNodeId);

      // Find conversation by matching last 7 characters (handles format differences)
      let targetConv = conversationMap.get(normalizedOtherId);
      if (!targetConv) {
        // Try matching by last 7 chars if exact match failed
        for (const [key, conv] of conversationMap.entries()) {
          if (key.slice(-7) === normalizedOtherId.slice(-7)) {
            targetConv = conv;
            break;
          }
        }
      }

      // If conversation still not found, create one for this node
      if (!targetConv) {
        const nodeInfo = nodes.find(n => {
          const normalizedNodeId = normalizeId(n.id);
          return normalizedNodeId.slice(-7) === normalizedOtherId.slice(-7);
        });
        
        targetConv = {
          nodeId: otherNodeId,
          nodeName: nodeInfo?.name || otherNodeId,
          lastMessage: null,
          messages: [],
          status: nodeInfo?.status || 'unknown',
        };
        conversationMap.set(normalizedOtherId, targetConv);
      }
      
      // Only add message if not already in conversation (prevent duplicates)
      if (!targetConv.messages.find(m => String(m.mes_id) === String(message.mes_id))) {
        targetConv.messages.push(message);
        
        // Update last message if this one is newer
        if (!targetConv.lastMessage || 
            new Date(message.timestamp) > new Date(targetConv.lastMessage.timestamp)) {
          targetConv.lastMessage = message;
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
  }, [messages, nodes, selfNodeId]);

  // Get broadcast messages (ONLY conversation is 0xffffffff)
  const broadcastMessages = useMemo(() => {
    return messages
      .filter(msg => {
        // ONLY include messages where conversation is broadcast (0xffffffff)
        if (!msg.conversation) return false;
        const normalizedConv = normalizeId(msg.conversation);
        return normalizedConv.slice(-8) === 'ffffffff';
      })
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }, [messages]);

  // Get messages for selected conversation
  const currentMessages = useMemo(() => {
    if (!selectedNodeId) return [];
    
    // Special case: broadcast messages
    if (selectedNodeId === 'broadcast') {
      return broadcastMessages;
    }
    
    const normalizedSelectedId = normalizeId(selectedNodeId);
    const conversation = conversations.find(c => normalizeId(c.nodeId) === normalizedSelectedId);
    return conversation?.messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ) || [];
  }, [selectedNodeId, conversations, broadcastMessages]);

  // Auto-select first conversation when component mounts or when changing context
  useEffect(() => {
    if (!selectedNodeId) {
      if (conversations.length > 0) {
        setSelectedNodeId(conversations[0].nodeId);
        autoSelectDoneRef.current = true;
      } else if (broadcastMessages.length > 0 && !autoSelectDoneRef.current) {
        setSelectedNodeId('broadcast');
        autoSelectDoneRef.current = true;
      }
    }
  }, [conversations.length, broadcastMessages.length, selectedNodeId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedNodeId || sending || recording || transcribing) return;

    try {
      setSending(true);
      // Handle broadcast address
      const destinationId = selectedNodeId === 'broadcast' 
        ? 'ffffffff' // Broadcast address
        : selectedNodeId.replace(/^0x/, ''); // Backend expects format like "6c7428d0" (no 0x prefix)
      
      const trimmedText = messageText.trim();
      const outgoingText = draftHasVoiceInput
        ? `[VR] ${trimmedText}`
        : trimmedText;

      await sendMessage(destinationId, outgoingText);
      setMessageText('');
      setDraftHasVoiceInput(false);
    } catch (err) {
      console.error('Failed to send message:', err);
      alert(`Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const cleanupRecording = async () => {
    audioProcessorRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
    }

    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioStreamRef.current = null;
    audioContextRef.current = null;
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const response = await fetch(`${API_BASE_URL}/api/voice/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Transcription failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) errorMessage = String(errorData.detail);
      } catch {
        // Keep the HTTP status text if the response is not JSON.
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return String(data.text || '').trim();
  };

  const handleStartRecording = async () => {
    if (recording || transcribing) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      audioChunksRef.current = [];
      recordingSampleRateRef.current = audioContext.sampleRate;

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      audioStreamRef.current = stream;
      setRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
      await cleanupRecording();
      setRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;

    const chunks = [...audioChunksRef.current];
    const sampleRate = recordingSampleRateRef.current;
    setRecording(false);
    await cleanupRecording();

    if (chunks.length === 0) {
      alert('No audio was captured. Please try recording again.');
      return;
    }

    try {
      setTranscribing(true);
      const wavBlob = encodeWav(mergeAudioChunks(chunks), sampleRate);
      const transcript = await transcribeAudio(wavBlob);

      if (!transcript) {
        alert('No speech was detected in the recording.');
        return;
      }

      setMessageText((current) => {
        const trimmedCurrent = current.trim();
        return trimmedCurrent ? `${trimmedCurrent} ${transcript}` : transcript;
      });
      setDraftHasVoiceInput(true);
    } catch (err) {
      console.error('Failed to transcribe recording:', err);
      alert(`Failed to transcribe recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTranscribing(false);
      audioChunksRef.current = [];
    }
  };

  const handleRecordButtonClick = () => {
    if (recording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  const handleComposerChange = (value: string) => {
    setMessageText(value);
    if (!value.trim()) {
      setDraftHasVoiceInput(false);
    }
  };

  const speakVoiceMessage = (text: string) => {
    const cleanText = getDisplayText(text).trim();
    if (!cleanText || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
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

  const getAckStatusIcon = (ackStatus: number | string, sentByMe: boolean) => {
    if (!sentByMe) return null;
    
    // Handle string "pending" or numeric status
    if (ackStatus === "pending" || ackStatus === 0) {
      return <Check className="h-3 w-3 text-muted-foreground" />; // Pending = Single check
    }
    
    switch (ackStatus) {
      case 1: // ACKED (Delivered)
        return <CheckCheck className="h-3 w-3 text-blue-500" />; // Acked = Double check
      case -1: // NACKED (Failed/Error)
        return <Circle className="h-3 w-3 text-red-500" />; // Nacked = Circle
      default: // Unknown
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const sendDisabled = !messageText.trim() || sending || recording || transcribing;
  const micDisabled = sending || transcribing;

  return (
    <div className="h-full flex rounded-lg border border-border overflow-hidden bg-card">
      {/* Left Panel - Conversations List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-border">
          <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>CONVERSATIONS</span>
            {selfNodeIdLongName && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                YOU: {selfNodeIdLongName}
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
          ) : (
            <>
              {/* Broadcast Messages - Always visible */}
              <div
                onClick={() => setSelectedNodeId('broadcast')}
                className={`p-3 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedNodeId === 'broadcast' ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Radio className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-card-foreground truncate">
                      Broadcast Messages
                    </span>
                  </div>
                  {broadcastMessages.length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                      {formatLastMessageTime(broadcastMessages[broadcastMessages.length - 1].timestamp)}
                    </span>
                  )}
                </div>
                {broadcastMessages.length > 0 ? (
                  <div className="mt-1 text-[11px] text-muted-foreground truncate ml-6">
                    {getDisplayText(broadcastMessages[broadcastMessages.length - 1].text)}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-muted-foreground/50 italic ml-6">
                    No broadcasts yet
                  </div>
                )}
              </div>

              {/* Individual Conversations */}
              {conversations.length === 0 && broadcastMessages.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No conversations available
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
                        {getDisplayText(conv.lastMessage.text)}
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
            </>
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
                {selectedNodeId === 'broadcast' ? (
                  <Radio className="h-4 w-4 text-orange-500" />
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-semibold text-card-foreground">
                    {selectedNodeId === 'broadcast' ? 'Broadcast Messages' : (selectedNode?.name || selectedNodeId)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {selectedNodeId === 'broadcast' ? 'All network broadcasts' : `Node ID: ${selectedNodeId}`}
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
                currentMessages.map((msg) => {
                  // For broadcast, find the sender's name
                  const senderNode = selectedNodeId === 'broadcast' 
                    ? nodes.find(n => {
                        const normalizedNodeId = normalizeId(n.id);
                        const normalizedSourceId = normalizeId(msg.source_id);
                        return normalizedNodeId.slice(-7) === normalizedSourceId.slice(-7);
                      })
                    : null;
                  
                  return (
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
                        {/* Show sender name for broadcast messages */}
                        {selectedNodeId === 'broadcast' && !msg.sent_by_me && senderNode && (
                          <div className="text-[10px] font-semibold mb-1 opacity-70">
                            {senderNode.name || senderNode.id}
                          </div>
                        )}
                        
                        <div className="flex items-start gap-2">
                          {isVoiceMessage(msg.text) && (
                            <button
                              type="button"
                              onClick={() => speakVoiceMessage(msg.text)}
                              className={`mt-0.5 h-6 w-6 flex-shrink-0 rounded-full inline-flex items-center justify-center transition-colors ${
                                msg.sent_by_me
                                  ? 'hover:bg-primary-foreground/20'
                                  : 'hover:bg-background/60'
                              }`}
                              title="Play voice message"
                              aria-label="Play voice message"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <div className="text-sm break-words min-w-0">
                            {getDisplayText(msg.text)}
                          </div>
                        </div>
                        
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
                  );
                })
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
              {(recording || transcribing) && (
                <div className="mb-2 text-[11px] text-muted-foreground">
                  {recording
                    ? 'Recording... send is paused until you stop.'
                    : 'Transcribing voice input...'}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => handleComposerChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={selectedNodeId === 'broadcast' ? 'Broadcast to all nodes...' : 'Type a message...'}
                  disabled={sending || transcribing}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleRecordButtonClick}
                  disabled={micDisabled}
                  className={`h-10 w-10 rounded-lg border border-border transition-colors inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                    recording
                      ? 'bg-red-500 text-white hover:bg-red-600 border-red-500'
                      : 'bg-background text-card-foreground hover:bg-accent'
                  }`}
                  title={recording ? 'Stop recording' : 'Record voice'}
                  aria-label={recording ? 'Stop recording' : 'Record voice'}
                >
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={sendDisabled}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {sending ? 'Sending...' : recording ? 'Recording' : transcribing ? 'Transcribing' : 'Send'}
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
