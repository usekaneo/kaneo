import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSprint } from "@/hooks/mutations/sprint/use-create-sprint";
import { useUpdateSprint } from "@/hooks/mutations/sprint/use-update-sprint";
import { toast } from "@/lib/toast";
import type Sprint from "@/types/sprint";

type SprintDialogProps = {
  projectId: string;
  sprint?: Sprint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// One dialog for both creating a sprint and editing a future or active one.
// Closed sprints never reach it: they are immutable history.
export default function SprintDialog({
  projectId,
  sprint,
  open,
  onOpenChange,
}: SprintDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");

  const { mutateAsync: createSprint, isPending: isCreating } =
    useCreateSprint();
  const { mutateAsync: updateSprint, isPending: isUpdating } =
    useUpdateSprint();
  const isPending = isCreating || isUpdating;

  useEffect(() => {
    if (open) {
      setName(sprint?.name ?? "");
      setGoal(sprint?.goal ?? "");
    }
  }, [open, sprint]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (sprint) {
        await updateSprint({
          id: sprint.id,
          projectId,
          data: {
            name: name.trim() || sprint.name,
            goal: goal.trim() || null,
          },
        });
      } else {
        await createSprint({
          projectId,
          data: {
            name: name.trim() || undefined,
            goal: goal.trim() || null,
          },
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:sprints.error", { defaultValue: "Sprint action failed" }),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {sprint
                ? t("tasks:sprints.editTitle")
                : t("tasks:sprints.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {sprint
                ? t("tasks:sprints.editDescription")
                : t("tasks:sprints.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="sprint-name"
              className="text-xs text-muted-foreground"
            >
              {t("tasks:sprints.name")}
            </Label>
            <Input
              id="sprint-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("tasks:sprints.namePlaceholder")}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="sprint-goal"
              className="text-xs text-muted-foreground"
            >
              {t("tasks:sprints.goal")}
            </Label>
            <Textarea
              id="sprint-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder={t("tasks:sprints.goalPlaceholder")}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {!sprint && <Plus className="h-4 w-4 mr-1" />}
              {sprint ? t("tasks:sprints.save") : t("tasks:sprints.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
