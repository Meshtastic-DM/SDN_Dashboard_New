import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";
import { useSetFixedPosition, useRemoveFixedPosition } from "@/hooks/useAdminApi";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

export default function PositionPanel({ selectedNode }: Props) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [altitude, setAltitude] = useState("");
  const [wantAck, setWantAck] = useState(false);

  const setPositionMutation = useSetFixedPosition();
  const removePositionMutation = useRemoveFixedPosition();

  const handleSetPosition = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const alt = altitude ? parseFloat(altitude) : 0;

    if (isNaN(lat) || isNaN(lon)) {
      return;
    }

    setPositionMutation.mutate({
      targetNode: selectedNode.id,
      latitude: lat,
      longitude: lon,
      altitude: alt,
      wantAck,
    });
  };

  const handleRemovePosition = () => {
    removePositionMutation.mutate({
      targetNode: selectedNode.id,
      wantAck,
    });
  };

  const isValidPosition = latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lat" className="text-xs font-mono text-muted-foreground">
          Latitude
        </Label>
        <Input
          id="lat"
          type="number"
          step="0.000001"
          placeholder="-90 to 90"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lon" className="text-xs font-mono text-muted-foreground">
          Longitude
        </Label>
        <Input
          id="lon"
          type="number"
          step="0.000001"
          placeholder="-180 to 180"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="alt" className="text-xs font-mono text-muted-foreground">
          Altitude (meters)
        </Label>
        <Input
          id="alt"
          type="number"
          placeholder="0"
          value={altitude}
          onChange={(e) => setAltitude(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs">
        <Checkbox checked={wantAck} onCheckedChange={setWantAck} />
        <span className="text-muted-foreground">Want ACK</span>
      </label>

      <div className="flex gap-2">
        <Button
          onClick={handleSetPosition}
          disabled={setPositionMutation.isPending || !isValidPosition}
          size="sm"
          className="flex-1 h-8 text-xs font-mono"
          variant="outline"
        >
          {setPositionMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Set Position
        </Button>

        <Button
          onClick={handleRemovePosition}
          disabled={removePositionMutation.isPending}
          size="sm"
          className="flex-1 h-8 text-xs font-mono"
          variant="outline"
        >
          {removePositionMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {selectedNode.latitude !== undefined && selectedNode.longitude !== undefined && (
        <div className="p-2 bg-muted/50 rounded text-xs font-mono space-y-1">
          <p className="text-muted-foreground">Current Position:</p>
          <p className="text-card-foreground">
            {selectedNode.latitude.toFixed(6)}, {selectedNode.longitude.toFixed(6)}
          </p>
          {selectedNode.altitude !== undefined && (
            <p className="text-muted-foreground">Alt: {selectedNode.altitude}m</p>
          )}
        </div>
      )}
    </div>
  );
}
