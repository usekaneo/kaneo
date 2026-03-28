import { Archive } from "lucide-react";
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
  const isSingular = taskCount === 1;
  const taskLabel = isSingular ? "completed task" : "completed tasks";
  const allLabel = isSingular ? "" : "all ";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-border bg-card shadow-2xl"
        showCloseButton={false}
      >
        <div className="p-8">
          <div className="flex flex-col gap-6">
            <DialogHeader className="flex flex-row items-center gap-4 text-left space-y-0 p-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <Archive className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                Archive Tasks
              </DialogTitle>
            </DialogHeader>

            <DialogDescription className="text-base text-muted-foreground leading-relaxed">
              Are you sure you want to archive {allLabel}
              <span className="font-bold text-foreground mx-1">
                {taskCount}
              </span>
              {taskLabel}? This will move them from the active board to your
              archive.
            </DialogDescription>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 px-8 py-5 flex flex-row justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent min-w-[80px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            className="shadow-sm min-w-[100px] font-medium"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
