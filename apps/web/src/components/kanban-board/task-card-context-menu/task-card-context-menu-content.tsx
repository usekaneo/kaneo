import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CircleDot,
  Clock,
  Copy,
  LinkIcon,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useDuplicateTask } from "@/hooks/mutations/task/use-duplicate-task";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useUpdateTaskDescription } from "@/hooks/mutations/task/use-update-task-description";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useUpdateTaskPriority } from "@/hooks/mutations/task/use-update-task-status-priority";
import { useUpdateTaskTitle } from "@/hooks/mutations/task/use-update-task-title";
import type getProjects from "@/fetchers/project/get-projects";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { generateLink } from "@/lib/generate-link";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { getTaskPath } from "@/lib/task-link";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";
import { DueDateSubmenu } from "./due-date-submenu";
import { TaskAssigneeDialog } from "./task-assignee-dialog";

type TaskCardContext = {
  worskpaceId: string;
  workspaceSlug?: string | null;
  projectId: string;
};

type TaskCardContextMenuContentProps = {
  task: Task;
  taskCardContext: TaskCardContext;
  onDeleteClick: () => void;
};

export default function TaskCardContextMenuContent({
  task,
  taskCardContext,
  onDeleteClick,
}: TaskCardContextMenuContentProps) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const queryClient = useQueryClient();
  const { data: columnsData = [] } = useGetColumns(taskCardContext.projectId);
  const columns =
    project?.columns && project.columns.length > 0
      ? project.columns.map((col) => ({
          slug: col.id,
          name: col.name,
          icon: col.icon,
          isFinal: col.isFinal,
        }))
      : columnsData.map((col) => ({
          slug: col.slug,
          name: col.name,
          icon: col.icon,
          isFinal: col.isFinal,
        }));
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { mutateAsync: updateTaskPriority } = useUpdateTaskPriority();
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const { mutateAsync: updateTaskTitle } = useUpdateTaskTitle();
  const { mutateAsync: updateTaskDescription } = useUpdateTaskDescription();
  const { mutate: duplicateTask } = useDuplicateTask();
  const { canCreateTasks, canUpdateTasks, canDeleteTasks, canAssignTasks } =
    useWorkspacePermission();
  const canCreate = canCreateTasks();
  const canEdit = canUpdateTasks();
  const canDelete = canDeleteTasks();
  const canAssign = canAssignTasks();

  const handleCopyTaskLink = () => {
    const path = getTaskPath({
      workspaceId: taskCardContext.worskpaceId,
      workspace: {
        id: taskCardContext.worskpaceId,
        slug: taskCardContext.workspaceSlug,
      },
      projectId: taskCardContext.projectId,
      workspaceProjects: queryClient.getQueryData<
        Awaited<ReturnType<typeof getProjects>>
      >(["projects", taskCardContext.worskpaceId]),
      taskId: task.id,
      taskNumber: task.number,
      title: task.title,
    });
    const taskLink = generateLink(path);

    navigator.clipboard.writeText(taskLink);
    toast.success(t("tasks:contextMenu.copyLinkSuccess"), { icon: LinkIcon });
  };

  const handleDuplicateTask = () => {
    duplicateTask({
      taskId: task.id,
      title: t("tasks:duplicate.titleSuffix", { title: task.title }),
    });
  };

  const handleChange = async (field: keyof Task, value: string | Date) => {
    try {
      switch (field) {
        case "priority":
          await updateTaskPriority({ ...task, priority: value as string });
          break;
        case "status":
          await updateTaskStatus({ ...task, status: value as string });
          break;
        case "title":
          await updateTaskTitle({ ...task, title: value as string });
          break;
        case "description":
          await updateTaskDescription({
            ...task,
            description: value as string,
          });
          break;
        default:
          await updateTask({
            ...task,
            [field]: value,
          });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:update.error"),
      );
    }
  };

  return (
    <>
      <ContextMenuContent className="w-46">
        <ContextMenuItem className="[&>svg]:mx-0" onClick={handleCopyTaskLink}>
          <LinkIcon className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:contextMenu.copyLink")}</span>
        </ContextMenuItem>

        {(canEdit || canAssign) && <ContextMenuSeparator />}

        {canEdit && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <PriorityGlyph priority="high" />
              <span>{t("tasks:priority.label")}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuCheckboxItem
                key="no-priority"
                checked={task.priority === "no-priority"}
                onCheckedChange={() => handleChange("priority", "no-priority")}
                closeOnClick
                className="[&_svg]:text-muted-foreground"
              >
                {getPriorityIcon("no-priority")}
                <span>{getPriorityLabel("no-priority")}</span>
              </ContextMenuCheckboxItem>
              {["low", "medium", "high", "urgent"].map((priority) => (
                <ContextMenuCheckboxItem
                  key={priority}
                  checked={task.priority === priority}
                  onCheckedChange={() => handleChange("priority", priority)}
                  closeOnClick
                  className="[&_svg]:text-muted-foreground"
                >
                  {getPriorityIcon(priority)}
                  <span className="capitalize">
                    {getPriorityLabel(priority)}
                  </span>
                </ContextMenuCheckboxItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {canEdit && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <CircleDot className="size-3.5 text-muted-foreground" />
              <span>{t("tasks:status.label")}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {columns.map((col) => (
                <ContextMenuCheckboxItem
                  key={col.slug}
                  checked={task.status === col.slug}
                  onCheckedChange={() => handleChange("status", col.slug)}
                  closeOnClick
                  className="[&_svg]:text-muted-foreground"
                >
                  {getColumnIcon(col.slug, col.isFinal, col.icon)}
                  <span>{col.name}</span>
                </ContextMenuCheckboxItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {canEdit && <DueDateSubmenu task={task} />}

        {canAssign && (
          <ContextMenuItem onClick={() => setAssigneeDialogOpen(true)}>
            <UserRound className="size-3.5 text-muted-foreground" />
            <span>{t("tasks:assignee.label")}</span>
          </ContextMenuItem>
        )}

        {(canCreate || canEdit || canDelete) && (
          <>
            {(canCreate || canEdit) && (
              <>
                <ContextMenuSeparator />

                {canCreate && (
                  <ContextMenuItem
                    className="[&>svg]:mx-0"
                    onClick={handleDuplicateTask}
                  >
                    <Copy className="size-3.5 text-muted-foreground" />
                    <span>{t("tasks:actions.duplicate")}</span>
                  </ContextMenuItem>
                )}

                {canEdit && (
                  <>
                    <ContextMenuItem
                      className="[&>svg]:mx-0"
                      onClick={() => handleChange("status", "archived")}
                    >
                      <Archive className="size-3.5 text-muted-foreground" />
                      <span>{t("tasks:actions.archive")}</span>
                    </ContextMenuItem>
                    {task.status !== "planned" && (
                      <ContextMenuItem
                        className="[&>svg]:mx-0"
                        onClick={() => handleChange("status", "planned")}
                      >
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span>{t("tasks:actions.markAsPlanned")}</span>
                      </ContextMenuItem>
                    )}
                  </>
                )}
              </>
            )}

            {canDelete && (
              <>
                <ContextMenuSeparator />

                <ContextMenuItem
                  className="text-destructive [&>svg]:mx-0"
                  onClick={(e) => {
                    e.preventDefault();
                    setTimeout(() => {
                      onDeleteClick();
                    }, 0);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  <span>{t("tasks:actions.delete")}</span>
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
      {canAssign && assigneeDialogOpen && (
        <TaskAssigneeDialog
          task={task}
          workspaceId={taskCardContext.worskpaceId}
          onClose={() => setAssigneeDialogOpen(false)}
        />
      )}
    </>
  );
}
