import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDaysIcon,
  CopyIcon,
  HashIcon,
  LinkIcon,
  type LucideIcon,
  UserRoundIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type BulkRequest,
  useBulkRequestStore,
} from "@/components/bulk-selection/bulk-request-store";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import type getProjects from "@/fetchers/project/get-projects";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { generateLink } from "@/lib/generate-link";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { getTaskPath } from "@/lib/task-link";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import type { TaskSelectionStore } from "./task-selection";

const findTask = (project: ProjectWithTasks | undefined, taskId: string) =>
  project &&
  [
    ...project.columns.flatMap((column) => column.tasks),
    ...project.plannedTasks,
    ...project.archivedTasks,
  ].find((task) => task.id === taskId);

export function useTaskActionShortcuts(selection: TaskSelectionStore) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const operations = useBulkOperations();
  const { canUpdateTasks, canAssignTasks, canDeleteTasks, canUpdateLabels } =
    useWorkspacePermission();

  const targets = () => {
    const { selectedTaskIds, focusedTaskId } = selection.getState();
    if (selectedTaskIds.size > 0)
      return { ids: [...selectedTaskIds], fromSelection: true };
    return focusedTaskId
      ? { ids: [focusedTaskId], fromSelection: false }
      : null;
  };

  const request = (kind: BulkRequest) => {
    const { selectedTaskIds, focusedTaskId, selectTasks } =
      selection.getState();
    if (selectedTaskIds.size > 0) {
      useBulkRequestStore.getState().send(kind, null);
      return;
    }
    if (!focusedTaskId) return;
    selectTasks([focusedTaskId]);
    useBulkRequestStore.getState().send(kind, focusedTaskId);
  };

  const run = async (
    action: (taskIds: string[]) => Promise<unknown>,
    success: (count: number) => string,
    icon: LucideIcon,
    error: string,
  ) => {
    const target = targets();
    if (!target) return;
    try {
      await action(target.ids);
      toast.message(success(target.ids.length), { icon });
      if (target.fromSelection) selection.getState().clearSelection();
    } catch {
      toast.error(error);
    }
  };

  const copy = async (text: string, message: string, icon: LucideIcon) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.message(message, { icon });
    } catch {
      toast.error(t("tasks:shortcuts.copyFailed"));
    }
  };

  const withFocusedTask = (act: (task: Task) => void) => {
    const taskId = selection.getState().focusedTaskId;
    const task = taskId
      ? findTask(useProjectStore.getState().project, taskId)
      : undefined;
    if (task) act(task);
  };

  const view = { scope: "view" as const };
  const edit = { ...view, enabled: canUpdateTasks() };
  const assign = { ...view, enabled: canAssignTasks() };
  const labels = { ...view, enabled: canUpdateLabels() };
  const remove = { ...view, enabled: canDeleteTasks() };

  useShortcut("changeStatus", () => request("status"), edit);
  useShortcut("changePriority", () => request("priority"), edit);
  useShortcut("assignTask", () => request("assignee"), assign);
  useShortcut("changeLabels", () => request("labels"), labels);
  useShortcut("setDueDate", () => request("dueDate"), edit);
  useShortcut("deleteTask", () => request("delete"), remove);

  useShortcut(
    "assignToMe",
    () => {
      if (!user) return;
      void run(
        (taskIds) => operations.bulkAssign({ taskIds, userId: user.id }),
        () => t("tasks:shortcuts.assignedToMe"),
        UserRoundIcon,
        t("tasks:bulk.assignError"),
      );
    },
    assign,
  );
  useShortcut(
    "removeDueDate",
    () =>
      void run(
        (taskIds) => operations.bulkDueDate({ taskIds, dueDate: null }),
        (count) => t("tasks:bulk.updateSuccess", { count }),
        CalendarDaysIcon,
        t("tasks:bulk.updateDueDateError"),
      ),
    edit,
  );

  useShortcut(
    "copyTaskId",
    () =>
      withFocusedTask((task) => {
        const slug = useProjectStore.getState().project?.slug;
        if (!slug || !task.number) return;
        void copy(
          `${slug}-${task.number}`,
          t("tasks:shortcuts.idCopied"),
          HashIcon,
        );
      }),
    view,
  );
  useShortcut(
    "copyTaskTitle",
    () =>
      withFocusedTask(
        (task) =>
          void copy(task.title, t("tasks:shortcuts.titleCopied"), CopyIcon),
      ),
    view,
  );
  useShortcut(
    "copyTaskUrl",
    () =>
      withFocusedTask((task) => {
        const project = useProjectStore.getState().project;
        if (!project) return;
        const path = getTaskPath({
          workspaceId: project.workspaceId,
          workspace,
          projectId: task.projectId,
          workspaceProjects: queryClient.getQueryData<
            Awaited<ReturnType<typeof getProjects>>
          >(["projects", project.workspaceId]),
          taskId: task.id,
          taskNumber: task.number,
          title: task.title,
        });
        void copy(
          generateLink(path),
          t("tasks:properties.taskLinkCopied"),
          LinkIcon,
        );
      }),
    view,
  );
}
