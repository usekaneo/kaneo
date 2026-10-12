import { NewCalendarFeedForm } from "@/components/project/calendar-feeds/new-calendar-feed-form";
import { Dialog, DialogPopup } from "@/components/ui/dialog";

type NewCalendarFeedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workspaceId: string;
};

export function NewCalendarFeedDialog({
  open,
  onOpenChange,
  projectId,
  workspaceId,
}: NewCalendarFeedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <NewCalendarFeedForm
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={() => onOpenChange(false)}
        />
      </DialogPopup>
    </Dialog>
  );
}
