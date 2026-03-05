import { createContext, useContext, ReactNode } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { Message } from '@/types/message';

interface MessagesContextType {
  messages: Message[];
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  sendMessage: (destinationId: string, text: string) => Promise<void>;
  refetchMessages: () => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export function MessagesProvider({ children }: { children: ReactNode }) {
  // Always keep WebSocket connected to maintain message state
  const messagesData = useMessages(true);

  return (
    <MessagesContext.Provider value={messagesData}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessagesContext() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessagesContext must be used within MessagesProvider');
  }
  return context;
}
