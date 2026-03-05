import { useNodes } from "@/hooks/useNodes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import '@/styles/components/ExtendedNodeView.css';

interface Props {
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

export default function ExtendedNodeView({ selectedNodeId, onSelectNode }: Props) {
  const { nodes, loading, error } = useNodes();

  return (
    <div className="h-full w-full rounded-lg border border-border overflow-hidden">
      <div className="p-3 border-b border-border font-mono text-xs text-muted-foreground">
        EXTENDED NODE VIEW — ALL NODES
      </div>
      <div className="overflow-auto max-h-[calc(100vh-220px)] scrollbar-thin">
        {loading && nodes.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-500 font-mono text-sm">
            Error: {error}
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground font-mono text-sm">
            No nodes found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {["ID", "Node Name", "Role", "HW Model", "SNR", "Battery", "Status", "Hops Away", "Latitude", "Longitude", "Altitude"].map(h => (
                  <TableHead key={h} className="font-mono text-xs text-secondary whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map(node => (
                <TableRow
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className={`cursor-pointer font-mono text-xs transition-colors border-border
                    ${selectedNodeId === node.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30"}`}
                >
                  <TableCell className="text-primary font-semibold">{node.id}</TableCell>
                  <TableCell className="text-card-foreground">{node.name}</TableCell>
                  <TableCell className="text-accent-foreground">{node.role || "—"}</TableCell>
                  <TableCell className="text-accent-foreground">{node.hwModel}</TableCell>
                  <TableCell>{node.snr}</TableCell>
                  <TableCell className="text-muted-foreground">{node.batteryLevel}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                      ${node.status === "online" ? "bg-node-online/10 text-node-online" :
                        node.status === "warning" ? "bg-node-warning/10 text-node-warning" :
                        "bg-node-offline/10 text-node-offline"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full
                        ${node.status === "online" ? "bg-node-online" :
                          node.status === "warning" ? "bg-node-warning" : "bg-node-offline"}`} />
                      {node.status}
                    </span>
                  </TableCell>
                  <TableCell>{node.hopsAway}</TableCell>
                  <TableCell>{node.latitude !== undefined ? node.latitude.toFixed(6) : "—"}</TableCell>
                  <TableCell>{node.longitude !== undefined ? node.longitude.toFixed(6) : "—"}</TableCell>
                  <TableCell>{node.altitude !== undefined ? `${node.altitude}m` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
