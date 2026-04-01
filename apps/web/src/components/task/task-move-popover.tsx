import { useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoveTask } from "@/hooks/mutations/task/use-move-task";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { cn } from "@/lib/cn";
import { getStatusLabel } from "@/lib/i18n/domain";
import type Task from "@/types/task";

type TaskMovePopoverProps = {
  task: Task;
  workspaceId: string;
  triggerClassName?: string;
};

export default function TaskMovePopover({
  task,
  workspaceId,
  triggerClassName,
}: TaskMovePopoverProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const { mutateAsync: moveTask, isPending: isMovePending } = useMoveTask();
  const destinationProjectId = selectedProjectId || "";
  const { data: destinationProject, isLoading: isProjectLoading, isError: isProjectError } = useGetTasks(destinationProjectId);

  const destinationProjects = useMemo(
    () => projects.filter((project) => project.id !== task.projectId),
    [projects, task.projectId],
  );

  const selectedProject = useMemo(
    () => destinationProjects.find((p) => p.id === selectedProjectId),
    [destinationProjects, selectedProjectId],
  );

  const destinationColumns = destinationProject?.columns ?? [];
  const canKeepCurrentStatus = destinationColumns.some(
    (column) => column.slug === task.status,
  );
  const fallbackStatus = destinationColumns[0]?.slug ?? "";
  const effectiveStatus = canKeepCurrentStatus
    ? task.status
    : selectedStatus || fallbackStatus;

  const selectedStatusLabel = useMemo(() => {
    if (!effectiveStatus || destinationColumns.length === 0) return null;
    const column = destinationColumns.find((c) => c.slug === effectiveStatus);
    return getStatusLabel(effectiveStatus) || column?.name || null;
  }, [destinationColumns, effectiveStatus]);

  useEffect(() => {
    if (!open) {
      setSelectedProjectId("");
      setSelectedStatus("");
    }
  }, [open]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedStatus("");
      return;
    }

    if (canKeepCurrentStatus) {
      setSelectedStatus(task.status);
      return;
    }

    setSelectedStatus(fallbackStatus);
  }, [canKeepCurrentStatus, fallbackStatus, selectedProjectId, task.status]);

  const handleMove = async () => {
    if (!selectedProjectId || !effectiveStatus) return;

    try {
      const result = await moveTask({
        taskId: task.id,
        destinationProjectId: selectedProjectId,
        destinationStatus: effectiveStatus,
      });

      setOpen(false);
      startTransition(() => {
        navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
          params: {
            workspaceId,
            projectId: result.task.projectId,
            taskId: task.id,
          },
        });
      });
    } catch {
      // toast is handled by useMoveTask's onError
    }
  };

  if (destinationProjects.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild nativeButton={false}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("text-foreground", triggerClassName)}
          title={t("tasks:move.title")}
          aria-label={t("tasks:move.title")}
        >
          <ArrowRightLeft className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end" sideOffset={4}>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">
            {t("tasks:move.title")}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("tasks:move.projectLabel")}
            </Label>
            <Select
              value={selectedProjectId || null}
              onValueChange={(value) =>
                setSelectedProjectId(String(value ?? ""))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("tasks:move.projectPlaceholder")}>
                  {selectedProject?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {destinationProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProjectId && isProjectLoading && (
            <div className="flex items-center justify-center py-2">
              <span className="text-xs text-muted-foreground">
                {t("tasks:move.statusLabel")}…
              </span>
            </div>
          )}

          {selectedProjectId && isProjectError && (
            <p className="text-xs text-destructive">
              {t("tasks:move.error")}
            </p>
          )}

          {selectedProjectId && !isProjectLoading && !isProjectError && destinationColumns.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("tasks:move.statusLabel")}
              </Label>
              <Select
                value={effectiveStatus || undefined}
                onValueChange={(value) =>
                  setSelectedStatus(String(value ?? ""))
                }
                disabled={canKeepCurrentStatus}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedStatusLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destinationColumns.map((column) => (
                    <SelectItem key={column.id} value={column.slug}>
                      {getStatusLabel(column.slug) || column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {canKeepCurrentStatus
                  ? t("tasks:move.statusHintKeep")
                  : t("tasks:move.statusHintAdjust")}
              </p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleMove()}
            disabled={
              !selectedProjectId ||
              !effectiveStatus ||
              isMovePending ||
              isPending ||
              isProjectLoading ||
              isProjectError
            }
            className="w-full font-medium"
          >
            {t("tasks:move.action")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
