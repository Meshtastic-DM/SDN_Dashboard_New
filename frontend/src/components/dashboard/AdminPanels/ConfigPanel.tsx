import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, EyeOff } from "lucide-react";
import { useGetConfig, useGetDeviceMetadata, useGetConnectionStatus } from "@/hooks/useAdminApi";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

const CONFIG_TYPES = [
  { id: 0, name: "Device" },
  { id: 1, name: "Position" },
  { id: 2, name: "Power" },
  { id: 3, name: "Network" },
  { id: 4, name: "Display" },
  { id: 5, name: "Lora" },
  { id: 6, name: "Telemetry" },
  { id: 7, name: "Module Config" },
];

export default function ConfigPanel({ selectedNode }: Props) {
  const [selectedConfig, setSelectedConfig] = useState("0");
  const [showResponse, setShowResponse] = useState<string | null>(null);

  const getConfigMutation = useGetConfig();
  const getMetadataMutation = useGetDeviceMetadata();
  const getStatusMutation = useGetConnectionStatus();

  const handleGetConfig = () => {
    getConfigMutation.mutate(
      { targetNode: selectedNode.id, configType: parseInt(selectedConfig) },
      { onSuccess: () => setShowResponse("config") }
    );
  };

  const handleGetMetadata = () => {
    getMetadataMutation.mutate({ targetNode: selectedNode.id }, { onSuccess: () => setShowResponse("metadata") });
  };

  const handleGetStatus = () => {
    getStatusMutation.mutate({ targetNode: selectedNode.id }, { onSuccess: () => setShowResponse("status") });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="config-select" className="text-xs font-mono text-muted-foreground">
          Configuration Type
        </Label>
        <Select value={selectedConfig} onValueChange={setSelectedConfig}>
          <SelectTrigger id="config-select" className="h-8 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONFIG_TYPES.map((config) => (
              <SelectItem key={config.id} value={config.id.toString()}>
                {config.id}: {config.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleGetConfig}
        disabled={getConfigMutation.isPending}
        size="sm"
        className="w-full h-8 text-xs font-mono"
        variant="outline"
      >
        {getConfigMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
        Get {CONFIG_TYPES.find((c) => c.id === parseInt(selectedConfig))?.name} Config
      </Button>

      <div className="border-t border-border pt-3">
        <Button
          onClick={handleGetMetadata}
          disabled={getMetadataMutation.isPending}
          size="sm"
          className="w-full h-8 text-xs font-mono mb-2"
          variant="outline"
        >
          {getMetadataMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Get Device Metadata
        </Button>

        <Button
          onClick={handleGetStatus}
          disabled={getStatusMutation.isPending}
          size="sm"
          className="w-full h-8 text-xs font-mono"
          variant="outline"
        >
          {getStatusMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Get Connection Status
        </Button>
      </div>

      {/* Response Display */}
      {showResponse === "config" && getConfigMutation.data && (
        <ResponseDisplay
          data={getConfigMutation.data.details}
          title="Configuration Response"
          onClose={() => setShowResponse(null)}
        />
      )}

      {showResponse === "metadata" && getMetadataMutation.data && (
        <ResponseDisplay
          data={getMetadataMutation.data.details}
          title="Device Metadata"
          onClose={() => setShowResponse(null)}
        />
      )}

      {showResponse === "status" && getStatusMutation.data && (
        <ResponseDisplay
          data={getStatusMutation.data.details}
          title="Connection Status"
          onClose={() => setShowResponse(null)}
        />
      )}
    </div>
  );
}

function ResponseDisplay({
  data,
  title,
  onClose,
}: {
  data: any;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="p-2 bg-muted/50 rounded text-xs font-mono space-y-2 max-h-48 overflow-y-auto">
      <div className="flex items-center justify-between mb-1 sticky top-0">
        <p className="text-muted-foreground font-semibold">{title}</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-card-foreground">
          <EyeOff className="h-3 w-3" />
        </button>
      </div>
      <pre className="text-[10px] text-card-foreground overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
