import { Dialog, DialogPopup } from "@/components/ui/dialog";
import { AddModelForm } from "./add-model-form";
import type { AdminAgentSettings, ModelChoice } from "./types";

type AddModelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: AdminAgentSettings["providers"];
  selectedIds: string[];
  pending: boolean;
  onAdd: (model: ModelChoice) => void;
};

export function AddModelDialog({
  open,
  onOpenChange,
  ...props
}: AddModelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <AddModelForm {...props} onClose={() => onOpenChange(false)} />
      </DialogPopup>
    </Dialog>
  );
}
