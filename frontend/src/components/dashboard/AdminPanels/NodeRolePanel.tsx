import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNodesContext } from "@/contexts/NodesContext";
import { NodeDisplayData } from "@/types/nodes";
import { Loader2, ShieldCheck, X } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const NODE_ROLES = ["Rescuer", "Fire Fighters", "Volunteers"] as const;
type NodeRole = typeof NODE_ROLES[number];

interface Props {
  selectedNode: NodeDisplayData;
}

export default function NodeRolePanel({ selectedNode }: Props) {
  const [role, setRole] = useState<NodeRole | "">("");
  const [savingRole, setSavingRole] = useState(false);
  const { toast } = useToast();
  const { refetch } = useNodesContext();

  useEffect(() => {
    setRole(NODE_ROLES.includes(selectedNode.role as NodeRole) ? selectedNode.role as NodeRole : "");
  }, [selectedNode]);

  const updateRole = async (nextRole: NodeRole | null) => {
    if (nextRole === selectedNode.role) return;

    try {
      setSavingRole(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/node/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_node: selectedNode.id,
          role: nextRole,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail || "Failed to update node role");
      }

      await refetch();
      toast({
        title: nextRole ? "Role updated" : "Role removed",
        description: nextRole
          ? `${selectedNode.name} is now marked as ${nextRole}.`
          : `${selectedNode.name} no longer has an assigned role.`,
      });
    } catch (error) {
      toast({
        title: "Role update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card/60 p-4">
        <div className="space-y-1">
          <div className="font-mono text-xs text-muted-foreground">CURRENT ROLE</div>
          <div className="font-mono text-sm text-card-foreground">{selectedNode.role || "No role assigned"}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="node-role-setting" className="font-mono text-xs text-muted-foreground">
            NODE ROLE SETTING
          </Label>
          <Select value={role} onValueChange={(value) => setRole(value as NodeRole)}>
            <SelectTrigger id="node-role-setting" className="font-mono">
              <SelectValue placeholder="Select node role" />
            </SelectTrigger>
            <SelectContent>
              {NODE_ROLES.map(nodeRole => (
                <SelectItem key={nodeRole} value={nodeRole} className="font-mono">
                  {nodeRole}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => updateRole(role as NodeRole)} disabled={savingRole || !role || role === selectedNode.role}>
          {savingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Save Role
        </Button>

        <Button variant="outline" onClick={() => updateRole(null)} disabled={savingRole || !selectedNode.role}>
          <X className="h-4 w-4" />
          Remove Role
        </Button>
      </div>
    </div>
  );
}
