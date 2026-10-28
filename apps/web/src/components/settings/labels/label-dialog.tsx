import { LabelForm } from "@/components/settings/labels/label-form";
import type { WorkspaceLabel } from "@/components/settings/labels/workspace-label";
import { Dialog, DialogPopup } from "@/components/ui/dialog";

type LabelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: WorkspaceLabel | null;
  workspaceId: string;
};

export function LabelDialog({
  open,
  onOpenChange,
  label,
  workspaceId,
}: LabelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <LabelForm
          label={label}
          workspaceId={workspaceId}
          onClose={() => onOpenChange(false)}
        />
      </DialogPopup>
    </Dialog>
  );
}
