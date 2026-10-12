import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { GitBranch, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HeaderIconButton } from "./header-icon-button";
import { TaskMoreMenu } from "./task-more-menu";
import { useTaskCopyActions } from "./use-task-copy-actions";

type TaskHeaderActionsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  deleteHandle: AlertDialogPrimitive.Handle<unknown>;
};

export function TaskHeaderActions({
  taskId,
  projectId,
  workspaceId,
  deleteHandle,
}: TaskHeaderActionsProps) {
  const { t } = useTranslation();
  const actions = useTaskCopyActions({ taskId, projectId, workspaceId });

  return (
    <div className="flex items-center gap-1">
      <HeaderIconButton
        label={t("tasks:properties.copyTaskLink")}
        shortcutId="copyTaskUrl"
        onClick={actions.copyLink}
        className="max-sm:hidden"
      >
        <Link2 />
      </HeaderIconButton>
      <HeaderIconButton
        label={t("tasks:properties.copyTaskBranch")}
        shortcutId="copyBranchName"
        onClick={actions.copyBranch}
        className="max-sm:hidden"
      >
        <GitBranch />
      </HeaderIconButton>
      <TaskMoreMenu actions={actions} deleteHandle={deleteHandle} />
    </div>
  );
}
