import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Copy, GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type Task from "@/types/task";
import TaskDeleteButton from "./task-delete-button";
import TaskMovePopover from "./task-move-popover";

type TaskActionsProps = {
  task: Task | undefined;
  workspaceId: string;
  canMoveTask: boolean;
  onCopyLink: () => void;
  onCopyBranch: () => void;
  deleteHandle: AlertDialogPrimitive.Handle<unknown>;
};

export default function TaskActions({
  task,
  workspaceId,
  canMoveTask,
  onCopyLink,
  onCopyBranch,
  deleteHandle,
}: TaskActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex *:not-first:rounded-s-none *:not-first:before:rounded-s-none *:not-last:rounded-e-none *:not-last:border-e-0 *:not-last:before:rounded-e-none">
      {task && canMoveTask && (
        <TaskMovePopover task={task} workspaceId={workspaceId} />
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("tasks:properties.copyTaskLink")}
              className="text-foreground"
              onClick={onCopyLink}
            >
              <Copy className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="flex items-center gap-2">
              {t("tasks:properties.copyTaskLink")}
              <ShortcutKeys id="copyTaskUrl" />
            </span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("tasks:properties.copyTaskBranch")}
              className="text-foreground"
              onClick={onCopyBranch}
            >
              <GitBranch className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="flex items-center gap-2">
              {t("tasks:properties.copyTaskBranch")}
              <ShortcutKeys id="copyBranchName" />
            </span>
          </TooltipContent>
        </Tooltip>
        {task && <TaskDeleteButton handle={deleteHandle} />}
      </TooltipProvider>
    </div>
  );
}
