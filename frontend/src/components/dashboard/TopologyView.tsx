import { mockNodes } from "@/data/mockNodes";
import '@/styles/components/TopologyView.css';
import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const VIEWBOX_WIDTH = 650;
const VIEWBOX_HEIGHT = 480;
const PADDING_X = 85;
const PADDING_Y = 70;

type TopologyNode = {
  id: string;
  name: string;
  type: "switch" | "router" | "controller" | "host";
  status: "online" | "offline" | "warning";
  connections: string[];
  x?: number;
  y?: number;
};

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
  })) as TopologyNode[]);

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
            x: typeof n.x === "number" ? n.x : undefined,
            y: typeof n.y === "number" ? n.y : undefined,
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

  const { connections, positions } = useMemo(() => {
    const nodeIds = new Set(nodes.map(node => node.id));
    const edgeMap = new Map<string, [string, string]>();
    const adjacency = new Map<string, string[]>();

    nodes.forEach(node => adjacency.set(node.id, []));

    nodes.forEach(node => {
      (node.connections || []).forEach((connectionId: string) => {
        const a = node.id;
        const b = connectionId;
        if (!nodeIds.has(a) || !nodeIds.has(b) || a === b) return;

        const edgeKey = [a, b].sort().join("-");
        if (!edgeMap.has(edgeKey)) edgeMap.set(edgeKey, [a, b]);
        adjacency.get(a)?.push(b);
        adjacency.get(b)?.push(a);
      });
    });

    const hasBackendPositions = nodes.length > 0 && nodes.every(
      node => typeof node.x === "number" && typeof node.y === "number"
    );

    if (hasBackendPositions) {
      return {
        connections: Array.from(edgeMap.values()),
        positions: nodes.reduce((acc, node) => {
          acc[node.id] = { x: node.x!, y: node.y! };
          return acc;
        }, {} as Record<string, { x: number; y: number }>),
      };
    }

    const orderedNodes = [...nodes].sort((a, b) => {
      const degreeDiff = (adjacency.get(b.id)?.length || 0) - (adjacency.get(a.id)?.length || 0);
      return degreeDiff || a.id.localeCompare(b.id);
    });

    const visited = new Set<string>();
    const components: TopologyNode[][] = [];

    orderedNodes.forEach(startNode => {
      if (visited.has(startNode.id)) return;

      const queue = [startNode.id];
      const componentIds: string[] = [];
      visited.add(startNode.id);

      while (queue.length) {
        const currentId = queue.shift()!;
        componentIds.push(currentId);
        (adjacency.get(currentId) || []).forEach(nextId => {
          if (visited.has(nextId)) return;
          visited.add(nextId);
          queue.push(nextId);
        });
      }

      components.push(
        componentIds
          .map(id => nodes.find(node => node.id === id))
          .filter(Boolean) as TopologyNode[]
      );
    });

    const positions: Record<string, { x: number; y: number }> = {};
    const componentHeight = (VIEWBOX_HEIGHT - PADDING_Y * 2) / Math.max(components.length, 1);

    components.forEach((component, componentIndex) => {
      const sortedComponent = [...component].sort((a, b) => {
        const degreeA = adjacency.get(a.id)?.length || 0;
        const degreeB = adjacency.get(b.id)?.length || 0;
        if (degreeA === 1 && degreeB !== 1) return -1;
        if (degreeB === 1 && degreeA !== 1) return 1;
        return a.id.localeCompare(b.id);
      });

      const root = sortedComponent[0];
      const levelMap = new Map<string, number>([[root.id, 0]]);
      const queue = [root.id];

      while (queue.length) {
        const currentId = queue.shift()!;
        const currentLevel = levelMap.get(currentId) || 0;
        (adjacency.get(currentId) || [])
          .sort((a, b) => a.localeCompare(b))
          .forEach(nextId => {
            if (levelMap.has(nextId)) return;
            levelMap.set(nextId, currentLevel + 1);
            queue.push(nextId);
          });
      }

      const levels = new Map<number, TopologyNode[]>();
      component.forEach(node => {
        const level = levelMap.get(node.id) || 0;
        if (!levels.has(level)) levels.set(level, []);
        levels.get(level)!.push(node);
      });

      const levelEntries = Array.from(levels.entries()).sort(([a], [b]) => a - b);
      const maxLevel = Math.max(levelEntries.length - 1, 1);
      const componentTop = PADDING_Y + componentIndex * componentHeight;
      const componentCenterY = componentTop + componentHeight / 2;
      const usableComponentHeight = Math.max(120, componentHeight - 35);

      levelEntries.forEach(([level, levelNodes]) => {
        const sortedLevelNodes = [...levelNodes].sort((a, b) => a.id.localeCompare(b.id));
        sortedLevelNodes.forEach((node, index) => {
          const x = PADDING_X + (level / maxLevel) * (VIEWBOX_WIDTH - PADDING_X * 2);
          const yOffset = sortedLevelNodes.length === 1
            ? 0
            : (index - (sortedLevelNodes.length - 1) / 2) * Math.min(90, usableComponentHeight / (sortedLevelNodes.length - 1));

          positions[node.id] = {
            x,
            y: Math.max(PADDING_Y, Math.min(VIEWBOX_HEIGHT - PADDING_Y / 2, componentCenterY + yOffset)),
          };
        });
      });
    });

    return {
      connections: Array.from(edgeMap.values()),
      positions,
    };
  }, [nodes]);

  return (
    <div className="h-full w-full bg-grid rounded-lg border border-border overflow-hidden relative">
      <div className="absolute top-3 left-3 font-mono text-xs text-muted-foreground z-10">
        TOPOLOGY VIEW
      </div>
      <svg width="100%" height="100%" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="min-h-[400px]">
        {/* Guide lines */}
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
