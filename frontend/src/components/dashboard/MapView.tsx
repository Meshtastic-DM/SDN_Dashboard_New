import { mockNodes, SDNNode } from "@/data/mockNodes";
import '@/styles/components/MapView.css';

interface Props {
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

const nodeColor = (node: SDNNode, selected: boolean) => {
  if (selected) return "hsl(155, 100%, 50%)";
  switch (node.status) {
    case "online": return "hsl(155, 80%, 45%)";
    case "warning": return "hsl(45, 90%, 55%)";
    case "offline": return "hsl(0, 60%, 50%)";
  }
};

const typeShape = (type: SDNNode["type"]) => {
  switch (type) {
    case "controller": return "diamond";
    case "router": return "hexagon";
    case "switch": return "rect";
    case "host": return "circle";
  }
};

function NodeShape({ node, selected, onClick }: { node: SDNNode; selected: boolean; onClick: () => void }) {
  const fill = nodeColor(node, selected);
  const shape = typeShape(node.type);
  const glow = selected ? `drop-shadow(0 0 8px ${fill})` : `drop-shadow(0 0 3px ${fill}40)`;

  return (
    <g onClick={onClick} className="cursor-pointer" style={{ filter: glow }}>
      {shape === "circle" && <circle cx={node.x} cy={node.y} r={14} fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth={2} />}
      {shape === "rect" && <rect x={node.x - 14} y={node.y - 14} width={28} height={28} rx={4} fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth={2} />}
      {shape === "diamond" && (
        <polygon
          points={`${node.x},${node.y - 16} ${node.x + 16},${node.y} ${node.x},${node.y + 16} ${node.x - 16},${node.y}`}
          fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth={2}
        />
      )}
      {shape === "hexagon" && (
        <polygon
          points={[0, 60, 120, 180, 240, 300].map(a => {
            const r = 15;
            return `${node.x + r * Math.cos((a * Math.PI) / 180)},${node.y + r * Math.sin((a * Math.PI) / 180)}`;
          }).join(" ")}
          fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth={2}
        />
      )}
      <text x={node.x} y={node.y + 30} textAnchor="middle" className="text-[10px] font-mono" fill="hsl(150, 30%, 70%)">
        {node.name}
      </text>
    </g>
  );
}

export default function MapView({ selectedNodeId, onSelectNode }: Props) {
  const connections: [string, string][] = [];
  mockNodes.forEach(node => {
    node.connections.forEach(c => {
      const key = [node.id, c].sort().join("-");
      if (!connections.find(([a, b]) => [a, b].sort().join("-") === key)) {
        connections.push([node.id, c]);
      }
    });
  });

  return (
    <div className="h-full w-full bg-grid rounded-lg border border-border overflow-hidden relative">
      <div className="absolute top-3 left-3 font-mono text-xs text-muted-foreground z-10">
        OFFLINE MAP — GRID VIEW
      </div>
      <svg width="100%" height="100%" viewBox="0 0 650 450" className="min-h-[400px]">
        {/* Grid dots */}
        {Array.from({ length: 27 }).map((_, i) =>
          Array.from({ length: 19 }).map((_, j) => (
            <circle key={`${i}-${j}`} cx={i * 25} cy={j * 25} r={0.5} fill="hsl(155, 100%, 50%)" fillOpacity={0.1} />
          ))
        )}

        {/* Connections */}
        {connections.map(([a, b]) => {
          const na = mockNodes.find(n => n.id === a)!;
          const nb = mockNodes.find(n => n.id === b)!;
          const isSelected = selectedNodeId === a || selectedNodeId === b;
          return (
            <line key={`${a}-${b}`}
              x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke={isSelected ? "hsl(270, 80%, 60%)" : "hsl(155, 100%, 50%)"}
              strokeOpacity={isSelected ? 0.6 : 0.15}
              strokeWidth={isSelected ? 2 : 1}
              strokeDasharray={isSelected ? "" : "4 4"}
            />
          );
        })}

        {/* Nodes */}
        {mockNodes.map(node => (
          <NodeShape key={node.id} node={node} selected={selectedNodeId === node.id} onClick={() => onSelectNode(node.id)} />
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-card/80 backdrop-blur rounded border border-border p-2 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-node-online" /> Online</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-node-warning" /> Warning</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-node-offline" /> Offline</div>
      </div>
    </div>
  );
}
