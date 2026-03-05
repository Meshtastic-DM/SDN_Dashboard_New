import { Network, Signal, Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/useTheme";
import '@/styles/components/DashboardHeader.css';

export default function DashboardHeader() {
  const { theme, toggle } = useTheme();

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Network className="h-5 w-5 text-primary" />
        <h1 className="font-mono text-sm font-bold text-primary glow-text-green tracking-wider">
          MeshFYP
        </h1>
        <span className="font-mono text-[10px] text-muted-foreground border border-border rounded px-2 py-0.5">
          NETWORK DASHBOARD v1.0
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <Sun className="h-3.5 w-3.5 text-muted-foreground" />
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
          <Moon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-node-online">
          <Signal className="h-3.5 w-3.5 animate-pulse-glow" />
          <span>CONNECTED</span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    </header>
  );
}
