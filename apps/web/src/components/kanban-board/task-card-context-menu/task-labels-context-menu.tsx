import { useTranslation } from "react-i18next";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import useAttachLabelToTask from "@/hooks/mutations/label/use-attach-label-to-task";
import useDetachLabelFromTask from "@/hooks/mutations/label/use-detach-label-from-task";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { getTaskLabelOptions } from "@/lib/get-task-label-options";
import { resolveLabelColor } from "@/lib/label-color";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

export default function TaskLabelsContextMenu({
  task,
  workspaceId,
}: {
  task: Task;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const taskLabels = useGetLabelsByTask(task.id);
  const workspaceLabels = useGetLabelsByWorkspace(workspaceId);
  const attach = useAttachLabelToTask();
  const detach = useDetachLabelFromTask();
  const labels = getTaskLabelOptions(workspaceLabels.data ?? [], task.id);
  const assignedLabels = taskLabels.data ?? task.labels ?? [];
  const isPending = attach.isPending || detach.isPending;

  const toggleLabel = async (labelId: string, name: string) => {
    const assigned = assignedLabels.find((label) => label.name === name);
    try {
      if (assigned) {
        await detach.mutateAsync({ labelId: assigned.id });
        toast.success(t("tasks:popover.labels.removeSuccess"));
      } else {
        await attach.mutateAsync({ labelId, taskId: task.id });
        toast.success(t("tasks:popover.labels.addSuccess"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.labels.updateError"),
      );
    }
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        {t("tasks:properties.labels")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-64 w-56 overflow-y-auto">
        {workspaceLabels.isError || taskLabels.isError ? (
          <ContextMenuItem
            closeOnClick={false}
            onClick={() => {
              void workspaceLabels.refetch();
              void taskLabels.refetch();
            }}
          >
            {t("tasks:popover.labels.loadError")}
          </ContextMenuItem>
        ) : workspaceLabels.isLoading || taskLabels.isLoading ? (
          <ContextMenuItem disabled>
            {t("common:empty.loading")}
          </ContextMenuItem>
        ) : labels.length === 0 ? (
          <ContextMenuItem disabled>
            {t("tasks:popover.labels.empty")}
          </ContextMenuItem>
        ) : (
          labels.map((label) => (
            <ContextMenuCheckboxItem
              key={label.id}
              checked={assignedLabels.some(
                (assigned) => assigned.name === label.name,
              )}
              closeOnClick={false}
              disabled={isPending}
              onCheckedChange={() => void toggleLabel(label.id, label.name)}
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: resolveLabelColor(label.color) }}
              />
              <span className="truncate">{label.name}</span>
            </ContextMenuCheckboxItem>
          ))
        )}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
