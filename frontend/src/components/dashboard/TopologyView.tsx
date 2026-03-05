import { mockNodes } from "@/data/mockNodes";
import '@/styles/components/TopologyView.css';

interface Props {
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

export default function TopologyView({ selectedNodeId, onSelectNode }: Props) {
  // Build adjacency
  const connections: [string, string][] = [];
  mockNodes.forEach(node => {
    node.connections.forEach(c => {
      const key = [node.id, c].sort().join("-");
      if (!connections.find(([a, b]) => [a, b].sort().join("-") === key)) {
        connections.push([node.id, c]);
      }
    });
  });

  // Layered layout
  const layers: Record<string, number> = { controller: 0, router: 1, switch: 2, host: 3 };
  const grouped = mockNodes.reduce((acc, n) => {
    const l = layers[n.type];
    if (!acc[l]) acc[l] = [];
    acc[l].push(n);
    return acc;
  }, {} as Record<number, typeof mockNodes>);

  const layerLabels = ["Controllers", "Routers", "Switches", "Hosts"];
  const positions: Record<string, { x: number; y: number }> = {};
  Object.entries(grouped).forEach(([layer, nodes]) => {
    const l = Number(layer);
    const y = 60 + l * 100;
    nodes.forEach((n, i) => {
      const x = 100 + i * (500 / Math.max(nodes.length, 1));
      positions[n.id] = { x, y };
    });
  });

  return (
    <div className="h-full w-full bg-grid rounded-lg border border-border overflow-hidden relative">
      <div className="absolute top-3 left-3 font-mono text-xs text-muted-foreground z-10">
        TOPOLOGY VIEW — LAYERED
      </div>
      <svg width="100%" height="100%" viewBox="0 0 650 480" className="min-h-[400px]">
        {/* Layer labels */}
        {Object.entries(grouped).map(([layer]) => {
          const l = Number(layer);
          return (
            <text key={l} x={20} y={60 + l * 100} className="text-[10px] font-mono" fill="hsl(270, 80%, 60%)" fillOpacity={0.6}>
              {layerLabels[l]}
            </text>
          );
        })}

        {/* Layer lines */}
        {[0, 1, 2, 3].map(l => (
          <line key={l} x1={15} x2={635} y1={60 + l * 100} y2={60 + l * 100}
            stroke="hsl(270, 60%, 50%)" strokeOpacity={0.08} strokeDasharray="8 4" />
        ))}

        {/* Connections */}
        {connections.map(([a, b]) => {
          const pa = positions[a];
          const pb = positions[b];
          if (!pa || !pb) return null;
          const isSelected = selectedNodeId === a || selectedNodeId === b;
          return (
            <line key={`${a}-${b}`}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={isSelected ? "hsl(155, 100%, 50%)" : "hsl(270, 60%, 50%)"}
              strokeOpacity={isSelected ? 0.7 : 0.2}
              strokeWidth={isSelected ? 2.5 : 1}
            />
          );
        })}

        {/* Nodes */}
        {mockNodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          const isSelected = selectedNodeId === node.id;
          const color = node.status === "online" ? "hsl(155, 80%, 45%)" :
                        node.status === "warning" ? "hsl(45, 90%, 55%)" : "hsl(0, 60%, 50%)";
          return (
            <g key={node.id} onClick={() => onSelectNode(node.id)} className="cursor-pointer">
              <circle cx={pos.x} cy={pos.y} r={isSelected ? 20 : 16}
                fill={color} fillOpacity={0.15}
                stroke={color} strokeWidth={isSelected ? 3 : 1.5}
                style={{ filter: isSelected ? `drop-shadow(0 0 10px ${color})` : undefined }}
              />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" className="text-[10px] font-mono font-bold" fill={color}>
                {node.id.toUpperCase()}
              </text>
              <text x={pos.x} y={pos.y + 32} textAnchor="middle" className="text-[9px] font-mono" fill="hsl(150, 20%, 55%)">
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
