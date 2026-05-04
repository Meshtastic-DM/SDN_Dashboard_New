import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNodesContext } from "@/contexts/NodesContext";
import { useRouteInstallSerial } from "@/hooks/useSdnSerialApi";
import { toast } from "sonner";

const MAX_HOPS = 8;

interface RouteInstallPanelProps {
  selectedNodeId: string | null;
}

const normalizeHex = (value: string) => value.trim().replace(/^!/, "").replace(/^0x/i, "").toLowerCase();

const formatNodeId = (value: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) {
    return "0x00000000";
  }
  return `0x${normalized.padStart(8, "0").toUpperCase()}`;
};

const extractLastByte = (value: string) => {
  const normalized = normalizeHex(value);
  return normalized.slice(-2).padStart(2, "0").toLowerCase();
};

export default function RouteInstallPanel({ selectedNodeId }: RouteInstallPanelProps) {
  const { nodes, loading, error, selfNodeId } = useNodesContext();
  const routeInstall = useRouteInstallSerial();

  const [startNode, setStartNode] = useState("");
  const [destinationNode, setDestinationNode] = useState("");
  const [installId, setInstallId] = useState("1");
  const [channelIndex, setChannelIndex] = useState("0");
  const [wantAck, setWantAck] = useState(false);
  const [hopNodes, setHopNodes] = useState<string[]>([""]);

  const nodeOptions = useMemo(
    () =>
      [...nodes].sort((a, b) => a.name.localeCompare(b.name)).map((node) => ({
        id: node.id,
        name: node.name,
      })),
    [nodes],
  );

  useEffect(() => {
    if (startNode || nodeOptions.length === 0) {
      return;
    }

    setStartNode(selfNodeId || selectedNodeId || nodeOptions[0].id);
  }, [nodeOptions, selectedNodeId, selfNodeId, startNode]);

  useEffect(() => {
    if (destinationNode || nodeOptions.length === 0) {
      return;
    }

    const effectiveStartNode = startNode || selfNodeId || selectedNodeId || nodeOptions[0].id;
    const defaultDestination =
      nodeOptions.find((node) => node.id === selectedNodeId && node.id !== effectiveStartNode)?.id ||
      nodeOptions.find((node) => node.id !== effectiveStartNode)?.id ||
      "";

    if (defaultDestination) {
      setDestinationNode(defaultDestination);
    }
  }, [destinationNode, nodeOptions, selectedNodeId, selfNodeId, startNode]);

  const resolvedPath = useMemo(() => hopNodes.filter(Boolean).map(extractLastByte), [hopNodes]);

  const canAddHop = hopNodes.length < MAX_HOPS;
  const nodesAvailable = nodeOptions.length > 0;

  const updateHopNode = (index: number, value: string) => {
    setHopNodes((current) => current.map((hop, hopIndex) => (hopIndex === index ? value : hop)));
  };

  const addHop = () => {
    if (!canAddHop) {
      return;
    }
    setHopNodes((current) => [...current, ""]);
  };

  const removeHop = (index: number) => {
    setHopNodes((current) => (current.length === 1 ? [""] : current.filter((_, hopIndex) => hopIndex !== index)));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedInstallId = Number(installId);
    const parsedChannelIndex = Number(channelIndex);
    const filteredHops = hopNodes.filter(Boolean);

    if (!nodesAvailable) {
      toast.error("No nodes available for route install");
      return;
    }

    if (!startNode) {
      toast.error("Select a start node");
      return;
    }

    if (!destinationNode) {
      toast.error("Select a destination node");
      return;
    }

    if (startNode === destinationNode) {
      toast.error("Start node and destination must be different");
      return;
    }

    if (!Number.isInteger(parsedInstallId) || parsedInstallId < 0 || parsedInstallId > 255) {
      toast.error("Install ID must be an integer between 0 and 255");
      return;
    }

    if (!Number.isInteger(parsedChannelIndex) || parsedChannelIndex < 0) {
      toast.error("Channel index must be a non-negative integer");
      return;
    }

    if (filteredHops.length === 0) {
      toast.error("Add at least one hop");
      return;
    }

    routeInstall.mutate({
      destination: destinationNode,
      path: filteredHops.map(extractLastByte),
      installId: parsedInstallId,
      startNode,
      channelIndex: parsedChannelIndex,
      wantAck,
    });
  };

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card className="border-border/80">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="font-mono text-base">ROUTE INSTALL</CardTitle>
                <CardDescription>Use the form below to construct and submit a route install request to the backend.
                </CardDescription>
              </div>
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 font-mono text-[11px] text-primary">
                Max {MAX_HOPS} hops
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="route-install-start-node">Start Node</Label>
                  <Select disabled={!nodesAvailable} onValueChange={setStartNode} value={startNode || undefined}>
                    <SelectTrigger id="route-install-start-node">
                      <SelectValue placeholder="Select a start node" />
                    </SelectTrigger>
                    <SelectContent>
                      {nodeOptions.map((node) => (
                        <SelectItem key={`start-${node.id}`} value={node.id}>
                          {node.name} ({formatNodeId(node.id)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Full 4-byte node ID used as `start_node`.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="route-install-destination">Destination</Label>
                  <Select
                    disabled={!nodesAvailable}
                    onValueChange={setDestinationNode}
                    value={destinationNode || undefined}
                  >
                    <SelectTrigger id="route-install-destination">
                      <SelectValue placeholder="Select a destination node" />
                    </SelectTrigger>
                    <SelectContent>
                      {nodeOptions.map((node) => (
                        <SelectItem key={`destination-${node.id}`} value={node.id}>
                          {node.name} ({formatNodeId(node.id)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Full 4-byte node ID used as `destination`.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="route-install-id">Install ID</Label>
                  <Input
                    id="route-install-id"
                    inputMode="numeric"
                    min={0}
                    max={255}
                    onChange={(event) => setInstallId(event.target.value)}
                    placeholder="1"
                    type="number"
                    value={installId}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="route-install-channel">Channel Index</Label>
                  <Input
                    id="route-install-channel"
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => setChannelIndex(event.target.value)}
                    placeholder="0"
                    type="number"
                    value={channelIndex}
                  />
                </div>

                <div className="flex items-end">
                  <label
                    className="flex w-full items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-3"
                    htmlFor="route-install-ack"
                  >
                    <Checkbox
                      checked={wantAck}
                      id="route-install-ack"
                      onCheckedChange={(checked) => setWantAck(checked === true)}
                    />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Request ACK</div>
                      <div className="text-xs text-muted-foreground">Enable `want_ack` for the serial send.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-mono text-sm font-semibold text-card-foreground">HOP PATH</h3>
                    <p className="text-xs text-muted-foreground">
                      Each selected node contributes its last byte to the `path` payload.
                    </p>
                  </div>
                  <Button disabled={!canAddHop || !nodesAvailable} onClick={addHop} size="sm" type="button" variant="outline">
                    <Plus className="h-4 w-4" />
                    Add Hop
                  </Button>
                </div>

                <div className="space-y-3">
                  {hopNodes.map((hopNode, index) => (
                    <div
                      key={`hop-${index}`}
                      className="grid gap-3 rounded-md border border-border bg-background/70 p-3 md:grid-cols-[minmax(0,1fr)_120px_44px]"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`route-install-hop-${index}`}>Hop {index + 1}</Label>
                        <Select
                          disabled={!nodesAvailable}
                          onValueChange={(value) => updateHopNode(index, value)}
                          value={hopNode || undefined}
                        >
                          <SelectTrigger id={`route-install-hop-${index}`}>
                            <SelectValue placeholder="Select a hop node" />
                          </SelectTrigger>
                          <SelectContent>
                            {nodeOptions.map((node) => (
                              <SelectItem key={`hop-${index}-${node.id}`} value={node.id}>
                                {node.name} ({formatNodeId(node.id)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Path Byte</Label>
                        <div className="flex h-10 items-center rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 font-mono text-sm text-primary">
                          {hopNode ? `0x${extractLastByte(hopNode).toUpperCase()}` : "--"}
                        </div>
                      </div>

                      <div className="flex items-end">
                        <Button
                          aria-label={`Remove hop ${index + 1}`}
                          onClick={() => removeHop(index)}
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>Node list is currently unavailable: {error}</div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={routeInstall.isPending || !nodesAvailable} type="submit">
                  <Send className="h-4 w-4" />
                  {routeInstall.isPending ? "Sending..." : "Install Route"}
                </Button>
                <div className="text-xs text-muted-foreground">
                  {loading ? "Loading nodes..." : `${resolvedPath.length} hop${resolvedPath.length === 1 ? "" : "s"} selected`}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="font-mono text-base">PAYLOAD PREVIEW</CardTitle>
              <CardDescription>Review the values that will be posted to the backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border bg-muted/20 p-4 font-mono text-xs">
                <div className="flex items-center gap-2 text-card-foreground">
                  <span>{startNode ? formatNodeId(startNode) : "START"}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{destinationNode ? formatNodeId(destinationNode) : "DESTINATION"}</span>
                </div>

                <div className="mt-4 space-y-2 text-muted-foreground">
                  <div>install_id: {installId || "1"}</div>
                  <div>channel_index: {channelIndex || "0"}</div>
                  <div>want_ack: {wantAck ? "true" : "false"}</div>
                  <div>path: [{resolvedPath.map((hop) => `0x${hop.toUpperCase()}`).join(", ")}]</div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hop Order
                </div>
                {hopNodes.some(Boolean) ? (
                  <div className="space-y-2">
                    {hopNodes
                      .filter(Boolean)
                      .map((hopNode, index) => (
                        <div key={`${hopNode}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate">{nodeOptions.find((node) => node.id === hopNode)?.name || hopNode}</span>
                          <span className="font-mono text-primary">0x{extractLastByte(hopNode).toUpperCase()}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No hop nodes selected yet.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="font-mono text-base">LAST RESPONSE</CardTitle>
              <CardDescription>Backend response from the most recent route install request.</CardDescription>
            </CardHeader>
            <CardContent>
              {routeInstall.data ? (
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/20 p-4 font-mono text-xs text-card-foreground">
                  {JSON.stringify(routeInstall.data, null, 2)}
                </pre>
              ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Submit a route install request to inspect the returned payload.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
