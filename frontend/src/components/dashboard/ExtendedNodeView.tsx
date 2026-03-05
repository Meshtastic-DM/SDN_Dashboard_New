import { mockNodes } from "@/data/mockNodes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import '@/styles/components/ExtendedNodeView.css';

interface Props {
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

export default function ExtendedNodeView({ selectedNodeId, onSelectNode }: Props) {
  return (
    <div className="h-full w-full rounded-lg border border-border overflow-hidden">
      <div className="p-3 border-b border-border font-mono text-xs text-muted-foreground">
        EXTENDED NODE VIEW — ALL NODES
      </div>
      <div className="overflow-auto max-h-[calc(100vh-220px)] scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {["ID", "Name", "Type", "IP Address", "MAC", "Port", "Status", "Uptime", "Throughput", "Latency", "Loss"].map(h => (
                <TableHead key={h} className="font-mono text-xs text-secondary whitespace-nowrap">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockNodes.map(node => (
              <TableRow
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`cursor-pointer font-mono text-xs transition-colors border-border
                  ${selectedNodeId === node.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30"}`}
              >
                <TableCell className="text-primary font-semibold">{node.id}</TableCell>
                <TableCell className="text-card-foreground">{node.name}</TableCell>
                <TableCell className="text-accent-foreground capitalize">{node.type}</TableCell>
                <TableCell>{node.ip}</TableCell>
                <TableCell className="text-muted-foreground">{node.mac}</TableCell>
                <TableCell>{node.port}</TableCell>
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
                <TableCell>{node.uptime}</TableCell>
                <TableCell>{node.throughput}</TableCell>
                <TableCell>{node.latency}</TableCell>
                <TableCell>{node.packetLoss}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
