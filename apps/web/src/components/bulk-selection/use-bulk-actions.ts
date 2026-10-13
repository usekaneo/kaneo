import {
  ArchiveIcon,
  CalendarDaysIcon,
  CircleDotIcon,
  type LucideIcon,
  SignalHighIcon,
  SquareKanbanIcon,
  SquircleDashedIcon,
  TagIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";

export function useBulkActions(
  selectedTaskIds: Set<string>,
  clearSelection: () => void,
) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const operations = useBulkOperations();
  const { data: workspace } = useActiveWorkspace();
  const { data: members = [] } = useGetProjectMembers({
    workspaceId: workspace?.id ?? "",
    projectId: project?.id ?? "",
  });
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(
    workspace?.id ?? "",
  );
  const { canUpdateTasks, canDeleteTasks, canAssignTasks, canUpdateLabels } =
    useWorkspacePermission();
  const [deleteCount, setDeleteCount] = useState<number | null>(null);
  const [lastDeleteCount, setLastDeleteCount] = useState(0);

  const labels = useMemo(() => {
    const byName = new Map<string, (typeof workspaceLabels)[number]>();
    for (const label of workspaceLabels) {
      const existing = byName.get(label.name);
      if (!existing || (label.taskId === null && existing.taskId !== null)) {
        byName.set(label.name, label);
      }
    }
    return Array.from(byName.values());
  }, [workspaceLabels]);

  const count = selectedTaskIds.size;
  const taskIds = () => Array.from(selectedTaskIds);

  const run = async (
    action: () => Promise<unknown>,
    success: string,
    icon: LucideIcon,
    error: string,
  ) => {
    try {
      await action();
      toast.success(success, { icon });
      clearSelection();
    } catch (_error) {
      toast.error(error);
    }
  };

  return {
    count,
    columns: project?.columns ?? [],
    members,
    labels,
    permissions: {
      edit: canUpdateTasks(),
      delete: canDeleteTasks(),
      assign: canAssignTasks(),
      labels: canUpdateLabels(),
    },
    changeStatus: (status: string) =>
      run(
        () => operations.bulkChangeStatus({ taskIds: taskIds(), status }),
        t("tasks:bulk.updateSuccess", { count }),
        CircleDotIcon,
        t("tasks:bulk.updateError"),
      ),
    setPriority: (priority: string) =>
      run(
        () => operations.bulkPriority({ taskIds: taskIds(), priority }),
        t("tasks:bulk.updateSuccess", { count }),
        SignalHighIcon,
        t("tasks:bulk.updatePriorityError"),
      ),
    assign: (userId: string) =>
      run(
        () => operations.bulkAssign({ taskIds: taskIds(), userId }),
        t("tasks:bulk.assignSuccess", { count }),
        UserRoundIcon,
        t("tasks:bulk.assignError"),
      ),
    addLabel: (labelId: string) =>
      run(
        () => operations.bulkAddLabel({ taskIds: taskIds(), labelId }),
        t("tasks:bulk.addLabelSuccess", { count }),
        TagIcon,
        t("tasks:bulk.addLabelError"),
      ),
    setDueDate: (date: Date | undefined) =>
      run(
        () =>
          operations.bulkDueDate({
            taskIds: taskIds(),
            dueDate: date?.toISOString() ?? null,
          }),
        t("tasks:bulk.updateSuccess", { count }),
        CalendarDaysIcon,
        t("tasks:bulk.updateDueDateError"),
      ),
    moveToBacklog: () =>
      run(
        () => operations.bulkMoveToBacklog(taskIds()),
        t("tasks:bulk.moveToBacklogSuccess", { count }),
        SquircleDashedIcon,
        t("tasks:bulk.moveToBacklogError"),
      ),
    moveToBoard: (status: string) =>
      run(
        () => operations.bulkMoveToBoard({ taskIds: taskIds(), status }),
        t("tasks:bulk.moveToBoardSuccess", { count }),
        SquareKanbanIcon,
        t("tasks:bulk.moveToBoardError"),
      ),
    archive: () =>
      run(
        () => operations.bulkArchive(taskIds()),
        t("tasks:bulk.archiveSuccess", { count }),
        ArchiveIcon,
        t("tasks:bulk.archiveError"),
      ),
    deleteConfirm: {
      open: deleteCount !== null,
      count: deleteCount ?? lastDeleteCount,
      pending: operations.isDeleting,
      request: () => {
        setDeleteCount(count);
        setLastDeleteCount(count);
      },
      onOpenChange: (open: boolean) => {
        if (!open) setDeleteCount(null);
      },
      confirm: async () => {
        const deleted = deleteCount ?? count;
        try {
          await operations.bulkDelete(taskIds());
          toast.success(t("tasks:bulk.deleteSuccess", { count: deleted }), {
            icon: Trash2Icon,
          });
          setDeleteCount(null);
          clearSelection();
        } catch (_error) {
          toast.error(t("tasks:bulk.deleteError"));
        }
      },
    },
  };
}

export type BulkActions = ReturnType<typeof useBulkActions>;
