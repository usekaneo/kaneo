import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleDashedIcon, UserRoundIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateSubtaskStatuses } from "@/fetchers/task/subtask-status";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import {
  clearSubtaskStatusPrompts,
  useSubtaskStatusDialog,
  type SubtaskStatusRequest,
} from "./store";

export function SubtaskStatusDialog() {
  const { t } = useTranslation();
  useEffect(() => clearSubtaskStatusPrompts, []);
  const queryClient = useQueryClient();
  const request = useSubtaskStatusDialog((state) => state.requests[0]);
  const dismiss = useSubtaskStatusDialog((state) => state.dismiss);
  const mutation = useMutation({
    mutationFn: async (request: SubtaskStatusRequest) => {
      return updateSubtaskStatuses(
        request.taskId,
        request.status,
        request.subtasks.map((task) => task.id),
      );
    },
    onSuccess: (_, confirmed) => {
      for (const key of [
        "tasks",
        "task",
        "task-relations",
        "activities",
        "projects",
        "notifications",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      invalidateMyWork(queryClient);
      dismiss(confirmed.taskId);
    },
  });
  const close = () => {
    if (!mutation.isPending) {
      mutation.reset();
      if (request) dismiss(request.taskId);
    }
  };
  const statusName =
    request?.status === "archived"
      ? t("tasks:subtaskStatus.archived")
      : request?.statusName;
  const missingDestination = request?.subtasks.some(
    (task) => !task.destinationStatus,
  );

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPopup className="sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("tasks:subtaskStatus.title")}</DialogTitle>
          <DialogDescription>
            {t("tasks:subtaskStatus.description", {
              count: request?.subtasks.length ?? 0,
              title: request?.parentTitle,
              status: statusName,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <ul className="divide-y rounded-lg border bg-muted/40">
            {request?.subtasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <CircleDashedIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 break-words">{task.title}</span>
                {task.assigneeName && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <UserRoundIcon aria-hidden="true" className="size-3" />
                    {task.assigneeName}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {missingDestination && (
            <p
              role="alert"
              className="mt-3 text-sm text-destructive-foreground"
            >
              {t("tasks:subtaskStatus.noFinalColumn")}
            </p>
          )}
          {mutation.isError && (
            <p
              role="alert"
              className="mt-3 text-sm text-destructive-foreground"
            >
              {t("tasks:subtaskStatus.updateError")}
            </p>
          )}
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={close}
          >
            {t("tasks:subtaskStatus.skip")}
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || missingDestination}
            onClick={() => {
              if (request) mutation.mutate(request);
            }}
          >
            {mutation.isPending
              ? t("tasks:subtaskStatus.updating")
              : t("tasks:subtaskStatus.updateAll")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
