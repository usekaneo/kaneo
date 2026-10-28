import { Dialog, DialogPopup } from "@/components/ui/dialog";
import type { ChannelAvailabilityMap } from "../notification-channels";
import { WorkspaceRuleForm } from "./workspace-rule-form";
import type { WorkspaceRule } from "./workspace-rule-state";

type WorkspaceRuleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: { id: string; name: string };
  rule: WorkspaceRule | undefined;
  availability: ChannelAvailabilityMap;
};

export function WorkspaceRuleDialog({
  open,
  onOpenChange,
  workspace,
  rule,
  availability,
}: WorkspaceRuleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <WorkspaceRuleForm
          availability={availability}
          onClose={() => onOpenChange(false)}
          rule={rule}
          workspace={workspace}
        />
      </DialogPopup>
    </Dialog>
  );
}
