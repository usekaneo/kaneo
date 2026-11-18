import { ArrowRightCircle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCloseSprint } from "@/hooks/mutations/sprint/use-close-sprint";
import { toast } from "@/lib/toast";
import type Sprint from "@/types/sprint";

type CloseSprintDialogProps = {
  sprint: Sprint;
  futureSprints: Sprint[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const BACKLOG_VALUE = "__backlog__";

// Mirrors the Jira flow: close the active sprint, choose where the unfinished
// work goes, and keep the completed tasks in the closed sprint as history.
export default function CloseSprintDialog({
  sprint,
  futureSprints,
  open,
  onOpenChange,
}: CloseSprintDialogProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string>(BACKLOG_VALUE);
  const { mutateAsync: closeSprint, isPending } = useCloseSprint();

  useEffect(() => {
    if (open) {
      setTarget(futureSprints[0]?.id ?? BACKLOG_VALUE);
    }
  }, [open, futureSprints]);

  const unfinishedTaskCount = sprint.taskCount - sprint.completedTaskCount;

  const handleConfirm = async () => {
    try {
      const result = await closeSprint({
        id: sprint.id,
        projectId: sprint.projectId,
        targetSprintId: target === BACKLOG_VALUE ? null : target,
      });
      toast.success(
        t("tasks:sprints.closeSuccess", {
          count: result.movedTaskIds.length,
        }),
      );
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
        <DialogHeader>
          <DialogTitle>{t("tasks:sprints.closeTitle")}</DialogTitle>
          <DialogDescription>
            {t("tasks:sprints.closeSummary", {
              name: sprint.name,
              completed: sprint.completedTaskCount,
              total: sprint.taskCount,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="close-target"
            className="text-xs text-muted-foreground"
          >
            {t("tasks:sprints.closeTarget", { count: unfinishedTaskCount })}
          </Label>
          <Select
            value={target}
            onValueChange={(value) => setTarget(String(value ?? BACKLOG_VALUE))}
          >
            <SelectTrigger id="close-target" className="w-full">
              <SelectValue>
                {target === BACKLOG_VALUE
                  ? t("tasks:sprints.backlog")
                  : futureSprints.find(
                      (futureSprint) => futureSprint.id === target,
                    )?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {futureSprints.map((futureSprint) => (
                <SelectItem key={futureSprint.id} value={futureSprint.id}>
                  {futureSprint.name}
                </SelectItem>
              ))}
              <SelectItem value={BACKLOG_VALUE}>
                {t("tasks:sprints.backlog")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            <ArrowRightCircle className="h-4 w-4 mr-1" />
            {t("tasks:sprints.closeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
