import { mockNodes, SDNNode } from "@/data/mockNodes";
import { Activity, Wifi, WifiOff, AlertTriangle, Server, Router, Cpu, Monitor } from "lucide-react";
import '@/styles/components/NodeDetailsSidebar.css';

const statusIcon = (status: SDNNode["status"]) => {
  switch (status) {
    case "online": return <Wifi className="h-3 w-3 text-node-online" />;
    case "offline": return <WifiOff className="h-3 w-3 text-node-offline" />;
    case "warning": return <AlertTriangle className="h-3 w-3 text-node-warning" />;
  }
};

const typeIcon = (type: SDNNode["type"]) => {
  switch (type) {
    case "switch": return <Server className="h-4 w-4" />;
    case "router": return <Router className="h-4 w-4" />;
    case "controller": return <Cpu className="h-4 w-4" />;
    case "host": return <Monitor className="h-4 w-4" />;
  }
};

interface Props {
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

export default function NodeDetailsSidebar({ selectedNodeId, onSelectNode }: Props) {
  const selected = mockNodes.find(n => n.id === selectedNodeId);

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-sidebar flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary animate-pulse-glow" />
          <h2 className="font-mono text-sm font-semibold text-primary glow-text-green">SDN NODES</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          {mockNodes.filter(n => n.status === "online").length}/{mockNodes.length} online
        </p>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {mockNodes.map(node => (
          <button
            key={node.id}
            onClick={() => onSelectNode(node.id)}
            className={`w-full text-left px-3 py-2 rounded-md transition-all text-xs font-mono
              ${selectedNodeId === node.id
                ? "bg-primary/10 border border-primary/30 glow-green"
                : "hover:bg-muted/50 border border-transparent"
              }`}
          >
            <div className="flex items-center gap-2">
              {typeIcon(node.type)}
              <span className="text-card-foreground font-medium">{node.name}</span>
              <span className="ml-auto">{statusIcon(node.status)}</span>
            </div>
            <div className="text-muted-foreground mt-1">{node.ip}</div>
          </button>
        ))}
      </div>

      {/* Selected Node Detail */}
      {selected && (
        <div className="border-t border-border p-4 space-y-3 bg-surface-elevated">
          <div className="flex items-center gap-2">
            {typeIcon(selected.type)}
            <span className="font-mono text-sm font-semibold text-primary glow-text-green">{selected.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {[
              ["IP", selected.ip],
              ["MAC", selected.mac.slice(0, 11) + "…"],
              ["Port", String(selected.port)],
              ["Status", selected.status.toUpperCase()],
              ["Uptime", selected.uptime],
              ["Throughput", selected.throughput],
              ["Latency", selected.latency],
              ["Pkt Loss", selected.packetLoss],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="text-muted-foreground">{label}</div>
                <div className={`text-card-foreground ${label === "Status" ?
                  selected.status === "online" ? "text-node-online" :
                  selected.status === "warning" ? "text-node-warning" : "text-node-offline"
                  : ""}`}>
                  {val}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-mono text-muted-foreground mb-1">Connections</div>
            <div className="flex flex-wrap gap-1">
              {selected.connections.map(c => (
                <button key={c} onClick={() => onSelectNode(c)}
                  className="px-2 py-0.5 rounded bg-accent/30 text-accent-foreground text-xs font-mono hover:bg-accent/50 transition-colors">
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
