import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { useReboot, useShutdown, useFactoryReset, useNodeDBReset } from "@/hooks/useAdminApi";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

export default function DeviceControlPanel({ selectedNode }: Props) {
  const [delaySeconds, setDelaySeconds] = useState("0");
  const [wantAck, setWantAck] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [clearFavorites, setClearFavorites] = useState(false);

  const rebootMutation = useReboot();
  const shutdownMutation = useShutdown();
  const factoryResetMutation = useFactoryReset();
  const nodedbResetMutation = useNodeDBReset();

  const handleReboot = () => {
    rebootMutation.mutate({
      targetNode: selectedNode.id,
      delaySeconds: parseInt(delaySeconds) || 0,
      wantAck,
    });
  };

  const handleShutdown = () => {
    shutdownMutation.mutate({
      targetNode: selectedNode.id,
      delaySeconds: parseInt(delaySeconds) || 0,
      wantAck,
    });
  };

  const handleFactoryReset = () => {
    if (!resetConfirm) return;
    factoryResetMutation.mutate({
      targetNode: selectedNode.id,
      wantAck,
    });
    setResetConfirm(false);
  };

  const handleNodeDBReset = () => {
    if (!resetConfirm) return;
    nodedbResetMutation.mutate({
      targetNode: selectedNode.id,
      clearFavorites,
      wantAck,
    });
    setResetConfirm(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <Label htmlFor="delay" className="text-muted-foreground">
            Delay (seconds)
          </Label>
          <Input
            id="delay"
            type="number"
            min="0"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={wantAck} onCheckedChange={setWantAck} />
            <span className="text-muted-foreground">Want ACK</span>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          onClick={handleReboot}
          disabled={rebootMutation.isPending}
          size="sm"
          className="w-full h-8 text-xs font-mono"
          variant="outline"
        >
          {rebootMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Reboot Device
        </Button>

        <Button
          onClick={handleShutdown}
          disabled={shutdownMutation.isPending}
          size="sm"
          className="w-full h-8 text-xs font-mono"
          variant="outline"
        >
          {shutdownMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Shutdown Device
        </Button>
      </div>

      <div className="border-t border-border pt-3">
        <div className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Danger Zone
        </div>

        {!resetConfirm ? (
          <div className="space-y-2">
            <Button
              onClick={() => setResetConfirm(true)}
              size="sm"
              className="w-full h-8 text-xs font-mono"
              variant="destructive"
            >
              Factory Reset
            </Button>

            <Button
              onClick={() => setResetConfirm(true)}
              size="sm"
              className="w-full h-8 text-xs font-mono"
              variant="destructive"
            >
              Reset NodeDB
            </Button>
          </div>
        ) : (
          <div className="space-y-2 p-2 bg-destructive/10 rounded border border-destructive/30">
            <p className="text-xs font-mono text-destructive">Confirm dangerous operation?</p>

            {true && (
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox checked={clearFavorites} onCheckedChange={setClearFavorites} />
                <span className="text-muted-foreground">Clear favorites (NodeDB only)</span>
              </label>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleFactoryReset}
                disabled={factoryResetMutation.isPending}
                size="sm"
                className="flex-1 h-7 text-xs font-mono"
                variant="destructive"
              >
                {factoryResetMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Reset
              </Button>
              <Button
                onClick={() => setResetConfirm(false)}
                size="sm"
                className="flex-1 h-7 text-xs font-mono"
                variant="outline"
              >
                Cancel
              </Button>
            </div>

            <Button
              onClick={handleNodeDBReset}
              disabled={nodedbResetMutation.isPending}
              size="sm"
              className="w-full h-7 text-xs font-mono"
              variant="destructive"
            >
              {nodedbResetMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Reset NodeDB
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
