import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RemoteAdminPanel from "./RemoteAdminPanel";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: NodeDisplayData | null;
}

export default function AdminModal({ isOpen, onOpenChange, selectedNode }: Props) {
  if (!selectedNode) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">REMOTE ADMINISTRATION</DialogTitle>
          <DialogDescription className="font-mono">
            {selectedNode.name} ({selectedNode.id.slice(0, 8)})
          </DialogDescription>
        </DialogHeader>
        <RemoteAdminPanel selectedNode={selectedNode} />
      </DialogContent>
    </Dialog>
  );
}
