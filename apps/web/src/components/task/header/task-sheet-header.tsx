import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { ChevronDown, ChevronRight, Maximize2, X } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ShortcutTooltipLabel } from "@/components/shortcuts/shortcut-tooltip-label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import icons from "@/constants/project-icons";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { HeaderIconButton } from "./header-icon-button";
import { TaskHeaderActions } from "./task-header-actions";
import { useTaskCopyActions } from "./use-task-copy-actions";

type TaskSheetHeaderProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  deleteHandle: AlertDialogPrimitive.Handle<unknown>;
  onOpenFullPage: () => void;
  onClose: () => void;
  closeButtonRef: Ref<HTMLButtonElement>;
};

export function TaskSheetHeader({
  taskId,
  projectId,
  workspaceId,
  deleteHandle,
  onOpenFullPage,
  onClose,
  closeButtonRef,
}: TaskSheetHeaderProps) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { copyId } = useTaskCopyActions({ taskId, projectId, workspaceId });
  const ProjectIcon =
    icons[project?.icon as keyof typeof icons] || icons.Layout;

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-border border-b px-2 sm:h-12 sm:gap-2 sm:pr-2.5 sm:pl-5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 max-sm:justify-center sm:gap-2">
        <ProjectIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground max-sm:hidden"
        />
        <span className="truncate font-medium text-[13px] text-muted-foreground">
          {project?.name}
        </span>
        {project?.slug && task?.number != null && (
          <>
            <ChevronRight
              aria-hidden="true"
              className="size-3 shrink-0 text-muted-foreground/60 max-sm:hidden"
            />
            <span
              aria-hidden="true"
              className="text-[13px] text-muted-foreground/60 sm:hidden"
            >
              /
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={copyId}
                    className="shrink-0 rounded-sm font-medium font-mono text-foreground text-xs outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
                  />
                }
              >
                {project.slug}-{task.number}
              </TooltipTrigger>
              <TooltipContent>
                <ShortcutTooltipLabel
                  label={t("navigation:shortcuts.items.copyTaskId")}
                  shortcutId="copyTaskId"
                />
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
      <TaskHeaderActions
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        deleteHandle={deleteHandle}
      />
      <span
        aria-hidden="true"
        className="mx-0.5 h-4 w-px bg-border max-sm:hidden"
      />
      <HeaderIconButton
        label={t("tasks:detail.openInFullPage")}
        onClick={onOpenFullPage}
        className="max-sm:hidden"
      >
        <Maximize2 />
      </HeaderIconButton>
      <Button
        ref={closeButtonRef}
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label={t("common:actions.close")}
        className="text-muted-foreground hover:text-foreground focus-visible:bg-accent focus-visible:ring-0 max-sm:order-first max-sm:size-9 max-sm:text-foreground/80 [&_svg]:size-[15px] max-sm:[&_svg]:size-4.5"
      >
        <ChevronDown className="sm:hidden" />
        <X className="max-sm:hidden" />
      </Button>
    </div>
  );
}
