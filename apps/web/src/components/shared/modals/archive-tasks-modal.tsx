import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ArchiveTasksModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskCount: number;
};

export function ArchiveTasksModal({
  open,
  onClose,
  onConfirm,
  taskCount,
}: ArchiveTasksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="px-3 pt-6 pb-2 gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Archive Tasks
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to archive all **{taskCount}** completed
              tasks? This will remove them from the active board.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-border text-foreground hover:bg-accent"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            size="sm"
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
          >
            Archive {taskCount} tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
