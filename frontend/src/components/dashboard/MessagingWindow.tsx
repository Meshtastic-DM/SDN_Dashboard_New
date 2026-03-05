import { mockMessages, Message } from "@/data/mockNodes";
import { Send, MessageSquare } from "lucide-react";
import { useState } from "react";
import '@/styles/components/MessagingWindow.css';

const typeStyles: Record<Message["type"], string> = {
  info: "border-l-primary text-primary",
  warning: "border-l-node-warning text-node-warning",
  error: "border-l-node-offline text-node-offline",
  packet: "border-l-secondary text-secondary",
};

const typeBadge: Record<Message["type"], string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-node-warning/10 text-node-warning",
  error: "bg-node-offline/10 text-node-offline",
  packet: "bg-secondary/10 text-secondary",
};

export default function MessagingWindow() {
  const [input, setInput] = useState("");

  return (
    <div className="h-full flex flex-col rounded-lg border border-border overflow-hidden">
      <div className="p-3 border-b border-border font-mono text-xs text-muted-foreground flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-secondary" />
        NETWORK MESSAGES — LIVE FEED
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {mockMessages.map(msg => (
          <div key={msg.id} className={`border-l-2 pl-3 py-2 ${typeStyles[msg.type]}`}>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${typeBadge[msg.type]}`}>
                {msg.type}
              </span>
              <span className="text-muted-foreground">{msg.timestamp}</span>
              <span className="text-muted-foreground">
                {msg.from} → {msg.to}
              </span>
            </div>
            <p className="text-xs text-card-foreground mt-1 font-mono">{msg.content}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Send command to controller..."
          className="flex-1 bg-muted border border-border rounded px-3 py-2 text-xs font-mono text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button className="bg-primary text-primary-foreground px-3 py-2 rounded text-xs font-mono font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1">
          <Send className="h-3 w-3" />
          Send
        </button>
      </div>
    </div>
  );
}
