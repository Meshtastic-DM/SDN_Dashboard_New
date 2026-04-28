import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Clock } from "lucide-react";
import { useSetTime } from "@/hooks/useAdminApi";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

export default function TimePanel({ selectedNode }: Props) {
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [customTimestamp, setCustomTimestamp] = useState("");
  const [wantAck, setWantAck] = useState(false);

  const setTimeMutation = useSetTime();

  const handleSetTime = () => {
    let timestamp: number;

    if (useCurrentTime) {
      timestamp = Math.floor(Date.now() / 1000);
    } else {
      const parsed = parseInt(customTimestamp);
      if (isNaN(parsed)) return;
      timestamp = parsed;
    }

    setTimeMutation.mutate({
      targetNode: selectedNode.id,
      timestamp,
      wantAck,
    });
  };

  const currentTime = Math.floor(Date.now() / 1000);
  const isValidCustom = !useCurrentTime && customTimestamp && !isNaN(parseInt(customTimestamp));

  return (
    <div className="space-y-4">
      <div className="p-2 bg-muted/50 rounded text-xs font-mono">
        <p className="text-muted-foreground">Current Time (Unix)</p>
        <p className="text-card-foreground font-semibold">{currentTime}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {new Date(currentTime * 1000).toLocaleString()}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs">
          <Checkbox
            checked={useCurrentTime}
            onCheckedChange={(checked) => setUseCurrentTime(checked === true)}
          />
          <span className="text-muted-foreground">Sync to current time</span>
        </label>

        {!useCurrentTime && (
          <>
            <Label htmlFor="timestamp" className="text-xs font-mono text-muted-foreground">
              Custom Timestamp (Unix seconds)
            </Label>
            <Input
              id="timestamp"
              type="number"
              placeholder="e.g., 1704067200"
              value={customTimestamp}
              onChange={(e) => setCustomTimestamp(e.target.value)}
              className="h-8 text-xs font-mono"
            />
            {customTimestamp && !isNaN(parseInt(customTimestamp)) && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(parseInt(customTimestamp) * 1000).toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <Checkbox checked={wantAck} onCheckedChange={setWantAck} />
        <span className="text-muted-foreground">Want ACK</span>
      </label>

      <Button
        onClick={handleSetTime}
        disabled={setTimeMutation.isPending || (!useCurrentTime && !isValidCustom)}
        size="sm"
        className="w-full h-8 text-xs font-mono"
        variant="outline"
      >
        {setTimeMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
        <Clock className="h-3 w-3 mr-1" />
        Sync Device Time
      </Button>

      <p className="text-[10px] text-muted-foreground pt-2">
        Synchronizes the device's internal clock to the specified time via mesh message.
      </p>
    </div>
  );
}
