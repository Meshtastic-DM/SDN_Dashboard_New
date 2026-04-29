import { mockNodes } from "@/data/mockNodes";
import '@/styles/components/TopologyView.css';
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface Props {
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

export default function TopologyView({ selectedNodeId, onSelectNode }: Props) {

  // Normalize IDs (support numeric IDs from API by converting to hex strings)
  const normalizeId = (id: number | string | null | undefined) => {
    if (id === null || id === undefined) return "";
    if (typeof id === "number") return `0x${id.toString(16).toUpperCase()}`;
    const s = String(id);
    if (s.startsWith("0x") || s.startsWith("0X")) return s.toUpperCase();
    return s.toUpperCase();
  };

  // Keep nodes in state so we can update from API
  const [nodes, setNodes] = useState(() => mockNodes.map(n => ({
    ...n,
    id: normalizeId(n.id as any),
    connections: (n.connections || []).map((c: any) => normalizeId(c)),
  })));

  // Selected id normalized for comparisons
  const selectedNormalized = selectedNodeId ? normalizeId(selectedNodeId) : null;

  // Fetch topology from API and build connections
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/routeview/topology`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Expecting { nodes: [{id,name}], links: [{source,target,...}] }
        const nodeMap = new Map<string, any>();
        (data.nodes || []).forEach((n: any) => {
          const id = normalizeId(n.id);
          nodeMap.set(id, {
            id,
            name: n.name || `Node ${id}`,
            type: n.type || 'router',
            status: n.status || 'online',
            connections: [] as string[],
          });
        });

        (data.links || []).forEach((l: any) => {
          const a = normalizeId(l.source ?? l.sourceId ?? l.src);
          const b = normalizeId(l.target ?? l.targetId ?? l.dst);
          if (!a || !b) return;
          if (!nodeMap.has(a)) nodeMap.set(a, { id: a, name: a, type: 'router', status: 'online', connections: [] });
          if (!nodeMap.has(b)) nodeMap.set(b, { id: b, name: b, type: 'router', status: 'online', connections: [] });
          const na = nodeMap.get(a);
          const nb = nodeMap.get(b);
          if (!na.connections.includes(b)) na.connections.push(b);
          if (!nb.connections.includes(a)) nb.connections.push(a);
        });

        if (mounted) setNodes(Array.from(nodeMap.values()));
      } catch (err) {
        // Leave mock nodes as fallback
        console.error('Topology fetch failed, using mockNodes', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Build adjacency
  const connections: [string, string][] = [];
  nodes.forEach(node => {
    (node.connections || []).forEach((c: string) => {
      const a = node.id;
      const b = c;
      const key = [a, b].sort().join("-");
      if (!connections.find(([x, y]) => [x, y].sort().join("-") === key)) {
        connections.push([a, b]);
      }
    });
  });

  // Layered layout
  const layers: Record<string, number> = { controller: 0, router: 1, switch: 2, host: 3 };
  const grouped = nodes.reduce((acc, n) => {
    const l = layers[n.type];
    if (!acc[l]) acc[l] = [];
    acc[l].push(n);
    return acc;
  }, {} as Record<number, typeof nodes>);

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
        TOPOLOGY VIEW
      </div>
      <svg width="100%" height="100%" viewBox="0 0 650 480" className="min-h-[400px]">
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
          const isSelected = selectedNormalized === a || selectedNormalized === b;
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
        {nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          const isSelected = selectedNormalized === node.id;
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
                {String(node.id).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
