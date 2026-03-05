import { mockRoutes } from "@/data/mockNodes";
import { ArrowRight, CheckCircle, AlertCircle, XCircle } from "lucide-react";import '@/styles/components/RouteAnalysis.css';
const statusConfig = {
  active: { icon: CheckCircle, color: "text-node-online", bg: "bg-node-online/10", label: "Active" },
  backup: { icon: AlertCircle, color: "text-node-warning", bg: "bg-node-warning/10", label: "Backup" },
  failed: { icon: XCircle, color: "text-node-offline", bg: "bg-node-offline/10", label: "Failed" },
};

export default function RouteAnalysis() {
  return (
    <div className="h-full rounded-lg border border-border overflow-hidden">
      <div className="p-3 border-b border-border font-mono text-xs text-muted-foreground">
        ROUTE ANALYSIS — PATH INSPECTION
      </div>

      <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-thin">
        {mockRoutes.map(route => {
          const cfg = statusConfig[route.status];
          const Icon = cfg.icon;
          return (
            <div key={route.id} className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-primary/20 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-primary font-semibold">{route.source}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-primary font-semibold">{route.destination}</span>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${cfg.bg} ${cfg.color}`}>
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
              </div>

              {/* Path visualization */}
              <div className="flex items-center gap-1 font-mono text-[11px]">
                {route.path.map((hop, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded border
                      ${route.status === "failed" ? "border-node-offline/30 text-node-offline" :
                        "border-primary/30 text-primary"}`}>
                      {hop}
                    </span>
                    {i < route.path.length - 1 && (
                      <ArrowRight className={`h-3 w-3 ${route.status === "failed" ? "text-node-offline/40" : "text-secondary/60"}`} />
                    )}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Hops</span>
                  <div className="text-card-foreground font-semibold">{route.hops}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Latency</span>
                  <div className="text-card-foreground font-semibold">{route.latency}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Bandwidth</span>
                  <div className="text-card-foreground font-semibold">{route.bandwidth}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
