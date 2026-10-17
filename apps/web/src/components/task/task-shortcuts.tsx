import { useNavigate } from "@tanstack/react-router";
import { UserRoundIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { toast } from "@/lib/toast";
import { useTaskCopyActions } from "./header/use-task-copy-actions";
import { clickTaskAction, focusTaskAction } from "./task-action-target";
import { useRelationPickerStore } from "./task-relation-picker-store";

type TaskShortcutsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  enabled?: boolean;
};

export function TaskShortcuts({
  taskId,
  projectId,
  workspaceId,
  enabled = true,
}: TaskShortcutsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: task } = useGetTask(taskId);
  const copyActions = useTaskCopyActions({ taskId, projectId, workspaceId });
  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { mutateAsync: updateAssignee } = useUpdateTaskAssignee();
  const { mutateAsync: updateDueDate } = useUpdateTaskDueDate();
  const openRelationPicker = useRelationPickerStore((state) => state.open);
  const { canUpdateTasks, canAssignTasks } = useWorkspacePermission();
  const active = { enabled: enabled && Boolean(task) };
  const editable = { enabled: active.enabled && canUpdateTasks() };
  const assignable = { enabled: active.enabled && canAssignTasks() };

  const openTask = (id: string | undefined) => {
    if (!id) return;
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId: id },
    });
  };

  useShortcut("changeStatus", () => clickTaskAction("status"), editable);
  useShortcut("changePriority", () => clickTaskAction("priority"), editable);
  useShortcut("assignTask", () => clickTaskAction("assignee"), assignable);
  useShortcut("changeLabels", () => clickTaskAction("labels"), editable);
  useShortcut("setDueDate", () => clickTaskAction("dueDate"), editable);
  useShortcut("moveToProject", () => clickTaskAction("move"), editable);
  useShortcut("addLink", () => clickTaskAction("addLink"), editable);
  useShortcut("createSubtask", () => clickTaskAction("addSubtask"), editable);
  useShortcut("toggleResources", () => clickTaskAction("resources"), active);
  useShortcut("renameTask", () => focusTaskAction("title"), editable);
  useShortcut(
    "editDescription",
    () => focusTaskAction("description"),
    editable,
  );
  useShortcut("commentOnTask", () => focusTaskAction("comment"), active);

  useShortcut(
    "assignToMe",
    async () => {
      if (!task || !user) return;
      try {
        await updateAssignee({ ...task, userId: user.id });
        toast.message(t("tasks:shortcuts.assignedToMe"), {
          icon: UserRoundIcon,
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.assignee.updateError"),
        );
      }
    },
    assignable,
  );

  useShortcut(
    "removeDueDate",
    async () => {
      if (!task?.dueDate) return;
      try {
        await updateDueDate({ ...task, dueDate: null });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.dueDate.updateError"),
        );
      }
    },
    editable,
  );

  useShortcut(
    "markBlockedBy",
    () => openRelationPicker(taskId, "blockedBy"),
    editable,
  );
  useShortcut(
    "markBlocking",
    () => openRelationPicker(taskId, "blocks"),
    editable,
  );
  useShortcut(
    "markRelated",
    () => openRelationPicker(taskId, "related"),
    editable,
  );
  useShortcut(
    "setParent",
    () => openRelationPicker(taskId, "parent"),
    editable,
  );

  useShortcut(
    "openParent",
    () =>
      openTask(
        relations.find(
          (relation) =>
            relation.relationType === "subtask" &&
            relation.targetTaskId === taskId,
        )?.sourceTaskId,
      ),
    active,
  );
  useShortcut(
    "openSubtask",
    () =>
      openTask(
        relations.find(
          (relation) =>
            relation.relationType === "subtask" &&
            relation.sourceTaskId === taskId,
        )?.targetTaskId,
      ),
    active,
  );

  useShortcut("copyTaskId", copyActions.copyId, active);
  useShortcut("copyTaskTitle", copyActions.copyTitle, active);
  useShortcut("copyAsMarkdown", copyActions.copyMarkdown, active);
  useShortcut("copyTaskUrl", copyActions.copyLink, active);
  useShortcut("copyBranchName", copyActions.copyBranch, active);

  return null;
}
