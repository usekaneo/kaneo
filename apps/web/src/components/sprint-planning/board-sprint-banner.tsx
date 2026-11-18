import { useNavigate } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns";
import { Play, Rocket, SquareCheckBig } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useStartSprint } from "@/hooks/mutations/sprint/use-start-sprint";
import { useGetSprints } from "@/hooks/queries/sprint/use-get-sprints";
import type Sprint from "@/types/sprint";
import CloseSprintDialog from "./close-sprint-dialog";

type BoardSprintBannerProps = {
  projectId: string;
  workspaceId: string;
};

function formatSprintRange(sprint: Sprint, t: (key: string) => string) {
  if (!sprint.startDate && !sprint.endDate) {
    return null;
  }
  const start = sprint.startDate
    ? formatDateShort(sprint.startDate)
    : t("tasks:sprints.unscheduled");
  const end = sprint.endDate
    ? formatDateShort(sprint.endDate)
    : t("tasks:sprints.unscheduled");
  return `${start} – ${end}`;
}

// The board's active sprint summary bar (feature list F-D5): it shows the
// active sprint with its progress and a close action, or lets the user pick
// and start one of the upcoming sprints when no sprint is active.
export default function BoardSprintBanner({
  projectId,
  workspaceId,
}: BoardSprintBannerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sprints = [] } = useGetSprints(projectId);
  const { mutateAsync: startSprint, isPending: isStarting } = useStartSprint();

  const [closingSprint, setClosingSprint] = useState<Sprint | null>(null);
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState("");

  const activeSprint = sprints.find((sprint) => sprint.status === "active");
  const futureSprints = sprints.filter((sprint) => sprint.status === "future");
  const nextSprint = futureSprints[0];

  useEffect(() => {
    if (isStartDialogOpen) {
      setSelectedSprintId(nextSprint?.id ?? "");
    }
  }, [isStartDialogOpen, nextSprint]);

  const handleStart = async (sprint: Sprint) => {
    try {
      await startSprint({ id: sprint.id, projectId });
      toast.success(t("tasks:sprints.startSuccess", { name: sprint.name }));
      setIsStartDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:sprints.error", { defaultValue: "Sprint action failed" }),
      );
    }
  };

  const selectedSprint = futureSprints.find(
    (sprint) => sprint.id === selectedSprintId,
  );

  if (!activeSprint && futureSprints.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b border-border/80 bg-card px-4 py-1.5">
        <Rocket className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {t("tasks:sprints.noActive")}
        </span>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto h-6 px-2 text-xs"
          onClick={() =>
            navigate({
              to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
              params: { workspaceId, projectId },
            })
          }
        >
          {t("tasks:view.backlog")}
        </Button>
      </div>
    );
  }

  if (!activeSprint && nextSprint) {
    return (
      <div className="flex items-center gap-2 border-b border-border/80 bg-card px-4 py-1.5">
        <Rocket className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {t("tasks:sprints.noActive")}
        </span>
        <span className="min-w-0 max-w-64 truncate text-xs font-medium">
          {nextSprint.name}
        </span>
        {formatSprintRange(nextSprint, t) && (
          <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">
            {formatSprintRange(nextSprint, t)}
          </span>
        )}
        <Button
          variant="outline"
          size="xs"
          className="ml-auto h-6 px-2 text-xs"
          onClick={() => setIsStartDialogOpen(true)}
        >
          <Play className="h-3 w-3 mr-1" />
          {t("tasks:sprints.start")}
        </Button>
        <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("tasks:sprints.start")}</DialogTitle>
              <DialogDescription>
                {t("tasks:sprints.noActive")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Select
                value={selectedSprintId}
                onValueChange={(value) =>
                  setSelectedSprintId(String(value ?? ""))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("tasks:sprints.upcoming")}>
                    {selectedSprint?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {futureSprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsStartDialogOpen(false)}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button
                disabled={!selectedSprint || isStarting}
                onClick={() => selectedSprint && handleStart(selectedSprint)}
              >
                <Play className="h-4 w-4 mr-1" />
                {t("tasks:sprints.start")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!activeSprint) {
    return null;
  }

  const remainingDays = activeSprint.endDate
    ? differenceInCalendarDays(new Date(activeSprint.endDate), new Date())
    : null;
  const progressPercent =
    activeSprint.taskCount > 0
      ? Math.round(
          (activeSprint.completedTaskCount / activeSprint.taskCount) * 100,
        )
      : null;

  return (
    <div className="flex items-center gap-2 border-b border-border/80 bg-card px-4 py-1.5">
      <Rocket className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 truncate text-sm font-semibold">
        {activeSprint.name}
      </span>
      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
        {t("tasks:sprints.activeBadge")}
      </span>
      <span className="hidden min-w-0 truncate text-xs text-muted-foreground lg:inline">
        {activeSprint.goal ?? formatSprintRange(activeSprint, t) ?? ""}
      </span>
      {remainingDays !== null && remainingDays > 0 && (
        <span className="shrink-0 text-xs font-medium text-primary">
          {t("tasks:sprints.daysRemaining", { remaining: remainingDays })}
        </span>
      )}
      {remainingDays === 0 && (
        <span className="shrink-0 text-xs font-medium text-primary">
          {t("tasks:sprints.endsToday")}
        </span>
      )}
      {remainingDays !== null && remainingDays < 0 && (
        <span className="shrink-0 text-xs font-medium text-destructive">
          {t("tasks:sprints.daysOverdue", {
            remaining: Math.abs(remainingDays),
          })}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t("tasks:sprints.taskCounts", {
            completed: activeSprint.completedTaskCount,
            total: activeSprint.taskCount,
          })}
        </span>
        {progressPercent !== null && (
          <span className="flex items-center gap-2">
            <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:block">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${progressPercent}%` }}
              />
            </span>
            <span className="text-xs text-muted-foreground">
              {progressPercent}%
            </span>
          </span>
        )}
        <Button
          variant="ghost"
          size="xs"
          className="h-6 px-2 text-xs"
          onClick={() => setClosingSprint(activeSprint)}
        >
          <SquareCheckBig className="h-3 w-3 mr-1" />
          {t("tasks:sprints.close")}
        </Button>
      </span>
      <CloseSprintDialog
        sprint={closingSprint ?? activeSprint}
        futureSprints={futureSprints}
        open={closingSprint !== null}
        onOpenChange={(open) => {
          if (!open) {
            setClosingSprint(null);
          }
        }}
      />
    </div>
  );
}
