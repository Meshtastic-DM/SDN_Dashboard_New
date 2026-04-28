import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Star, Eye } from "lucide-react";
import {
  useSetFavoriteNode,
  useRemoveFavoriteNode,
  useSetIgnoredNode,
  useRemoveIgnoredNode,
} from "@/hooks/useAdminApi";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

export default function NodeManagementPanel({ selectedNode }: Props) {
  const [favoriteNodeId, setFavoriteNodeId] = useState("");
  const [ignoredNodeId, setIgnoredNodeId] = useState("");
  const [wantAck, setWantAck] = useState(false);

  const setFavoriteMutation = useSetFavoriteNode();
  const removeFavoriteMutation = useRemoveFavoriteNode();
  const setIgnoredMutation = useSetIgnoredNode();
  const removeIgnoredMutation = useRemoveIgnoredNode();

  const handleSetFavorite = () => {
    if (!favoriteNodeId.trim()) return;
    setFavoriteMutation.mutate(
      { targetNode: selectedNode.id, nodeToFavorite: favoriteNodeId, wantAck },
      { onSuccess: () => setFavoriteNodeId("") }
    );
  };

  const handleRemoveFavorite = () => {
    if (!favoriteNodeId.trim()) return;
    removeFavoriteMutation.mutate(
      { targetNode: selectedNode.id, nodeToRemove: favoriteNodeId, wantAck },
      { onSuccess: () => setFavoriteNodeId("") }
    );
  };

  const handleSetIgnored = () => {
    if (!ignoredNodeId.trim()) return;
    setIgnoredMutation.mutate(
      { targetNode: selectedNode.id, nodeToIgnore: ignoredNodeId, wantAck },
      { onSuccess: () => setIgnoredNodeId("") }
    );
  };

  const handleRemoveIgnored = () => {
    if (!ignoredNodeId.trim()) return;
    removeIgnoredMutation.mutate(
      { targetNode: selectedNode.id, nodeToUnignore: ignoredNodeId, wantAck },
      { onSuccess: () => setIgnoredNodeId("") }
    );
  };

  return (
    <div className="space-y-4">
      {/* Favorite Nodes */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Star className="h-3 w-3 text-amber-500" />
          <Label className="text-xs font-mono text-muted-foreground">Favorite Nodes</Label>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="Node ID (e.g., !a1b2c3d4)"
            value={favoriteNodeId}
            onChange={(e) => setFavoriteNodeId(e.target.value)}
            className="h-8 text-xs font-mono"
          />

          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={wantAck} onCheckedChange={setWantAck} />
            <span className="text-muted-foreground">Want ACK</span>
          </label>

          <div className="flex gap-2">
            <Button
              onClick={handleSetFavorite}
              disabled={setFavoriteMutation.isPending || !favoriteNodeId.trim()}
              size="sm"
              className="flex-1 h-8 text-xs font-mono"
              variant="outline"
            >
              {setFavoriteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Add Favorite
            </Button>

            <Button
              onClick={handleRemoveFavorite}
              disabled={removeFavoriteMutation.isPending || !favoriteNodeId.trim()}
              size="sm"
              className="flex-1 h-8 text-xs font-mono"
              variant="outline"
            >
              {removeFavoriteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Remove
            </Button>
          </div>
        </div>
      </div>

      {/* Ignored Nodes */}
      <div className="border-t border-border pt-3">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-3 w-3 text-red-500" />
          <Label className="text-xs font-mono text-muted-foreground">Ignored Nodes</Label>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="Node ID (e.g., !a1b2c3d4)"
            value={ignoredNodeId}
            onChange={(e) => setIgnoredNodeId(e.target.value)}
            className="h-8 text-xs font-mono"
          />

          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={wantAck} onCheckedChange={setWantAck} />
            <span className="text-muted-foreground">Want ACK</span>
          </label>

          <div className="flex gap-2">
            <Button
              onClick={handleSetIgnored}
              disabled={setIgnoredMutation.isPending || !ignoredNodeId.trim()}
              size="sm"
              className="flex-1 h-8 text-xs font-mono"
              variant="outline"
            >
              {setIgnoredMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Ignore
            </Button>

            <Button
              onClick={handleRemoveIgnored}
              disabled={removeIgnoredMutation.isPending || !ignoredNodeId.trim()}
              size="sm"
              className="flex-1 h-8 text-xs font-mono"
              variant="outline"
            >
              {removeIgnoredMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Unignore
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
