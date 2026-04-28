import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useSetOwner, useGetOwner } from "@/hooks/useAdminApi";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

export default function OwnerPanel({ selectedNode }: Props) {
  const [longName, setLongName] = useState("");
  const [shortName, setShortName] = useState("");
  const [isLicensed, setIsLicensed] = useState(false);
  const [wantAck, setWantAck] = useState(true);
  const [showResponse, setShowResponse] = useState(false);

  const setOwnerMutation = useSetOwner();
  const getOwnerMutation = useGetOwner();

  const handleSetOwner = () => {
    if (!longName.trim() || !shortName.trim()) return;
    setOwnerMutation.mutate({
      targetNode: selectedNode.id,
      longName: longName.trim(),
      shortName: shortName.trim(),
      isLicensed,
      wantAck,
    });
  };

  const handleGetOwner = () => {
    getOwnerMutation.mutate(
      { targetNode: selectedNode.id },
      { onSuccess: () => setShowResponse(true) }
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="longName" className="text-xs font-mono text-muted-foreground">
          Long Name (Owner)
        </Label>
        <Input
          id="longName"
          type="text"
          placeholder="e.g., Your Name"
          value={longName}
          onChange={(e) => setLongName(e.target.value)}
          className="h-8 text-xs font-mono"
          maxLength={40}
        />
        <p className="text-[10px] text-muted-foreground">{longName.length}/40 characters</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shortName" className="text-xs font-mono text-muted-foreground">
          Short Name
        </Label>
        <Input
          id="shortName"
          type="text"
          placeholder="e.g., YN"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          className="h-8 text-xs font-mono"
          maxLength={4}
        />
        <p className="text-[10px] text-muted-foreground">{shortName.length}/4 characters</p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <Checkbox checked={isLicensed} onCheckedChange={setIsLicensed} />
        <span className="text-muted-foreground">Licensed Operator</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <Checkbox checked={wantAck} onCheckedChange={setWantAck} />
        <span className="text-muted-foreground">Want ACK</span>
      </label>

      <div className="flex gap-2">
        <Button
          onClick={handleSetOwner}
          disabled={setOwnerMutation.isPending || !longName.trim() || !shortName.trim()}
          size="sm"
          className="flex-1 h-8 text-xs font-mono"
          variant="outline"
        >
          {setOwnerMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Set Owner
        </Button>

        <Button
          onClick={handleGetOwner}
          disabled={getOwnerMutation.isPending}
          size="sm"
          className="flex-1 h-8 text-xs font-mono"
          variant="outline"
        >
          {getOwnerMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Get Owner
        </Button>
      </div>

      {getOwnerMutation.data && showResponse && (
        <div className="p-2 bg-muted/50 rounded text-xs font-mono space-y-2 max-h-32 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <p className="text-muted-foreground font-semibold">Response</p>
            <button
              onClick={() => setShowResponse(false)}
              className="text-muted-foreground hover:text-card-foreground"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          </div>
          <pre className="text-[10px] text-card-foreground overflow-x-auto">
            {JSON.stringify(getOwnerMutation.data.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
