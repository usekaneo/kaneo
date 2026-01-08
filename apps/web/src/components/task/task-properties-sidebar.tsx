import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  Copy,
  GitBranch,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import labelColors from "@/constants/label-colors";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import TaskAssigneePopover from "./task-assignee-popover";
import TaskDueDatePopover from "./task-due-date-popover";
import TaskLabelsPopover from "./task-labels-popover";
import TaskPriorityPopover from "./task-priority-popover";
import TaskStatusPopover from "./task-status-popover";

function slugify(text: string | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function generateBranchName(
  pattern: string,
  projectSlug: string | undefined,
  taskNumber: number | null | undefined,
  taskTitle: string | undefined,
): string {
  if (!projectSlug || !taskNumber) return "";
  return pattern
    .replace("{slug}", projectSlug.toLowerCase())
    .replace("{number}", taskNumber.toString())
    .replace("{title}", slugify(taskTitle));
}

function toNormalCase(str: string | undefined) {
  if (!str) return str;
  return str
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

type TaskPropertiesSidebarProps = {
  taskId: string | undefined;
  projectId: string;
  workspaceId: string;
  className?: string;
};

export default function TaskPropertiesSidebar({
  taskId,
  projectId,
  workspaceId,
  className,
}: TaskPropertiesSidebarProps) {
  const { data: task } = useGetTask(taskId ?? "");
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: taskLabels = [] } = useGetLabelsByTask(taskId);
  const { data: githubIntegration } = useGetGithubIntegration(projectId);

  const projectSlug = project?.slug;
  const taskNumber = task?.number;
  const branchPattern = githubIntegration?.branchPattern || "{slug}-{number}";

  const assignee = workspaceUsers?.members?.find(
    (member) => member.userId === task?.userId,
  );

  const handleCopyTaskLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/workspace/${workspaceId}/project/${projectId}/task/${taskId}`,
    );
    toast.message("Task link copied to clipboard");
  };

  const handleCopyTaskBranch = () => {
    const branchName = generateBranchName(
      branchPattern,
      projectSlug,
      taskNumber,
      task?.title,
    );
    navigator.clipboard.writeText(branchName);
    toast.message("Task branch copied to clipboard");
  };

  return (
    <div className={className}>
      <div className="flex gap-2 p-3 lg:p-4 lg:px-4">
        <p className="text-sm font-medium text-muted-foreground flex-1">
          Properties
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => handleCopyTaskLink()}
              >
                <Copy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <KbdSequence
                keys={["Ctrl", "Shift", "C"]}
                description="Copy task link"
                separator=""
              />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => handleCopyTaskBranch()}
              >
                <GitBranch className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <KbdSequence
                keys={["Ctrl", "Shift", "G"]}
                description="Copy task branch"
                separator=""
              />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex flex-row flex-wrap lg:flex-col gap-1 lg:gap-2 items-start px-3 lg:px-4 pb-3 lg:pb-0">
        {task && (
          <TaskStatusPopover task={task}>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 px-2"
            >
              {getColumnIcon(task.status ?? "")}
              <span className="text-xs font-semibold truncate">
                {toNormalCase(task.status)}
              </span>
            </Button>
          </TaskStatusPopover>
        )}
        {task && (
          <TaskPriorityPopover task={task}>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 px-2"
            >
              {getPriorityIcon(task.priority ?? "")}
              <span className="text-xs font-semibold truncate">
                {toNormalCase(task.priority ?? "")}
              </span>
            </Button>
          </TaskPriorityPopover>
        )}
        {task && (
          <TaskAssigneePopover task={task} workspaceId={workspaceId}>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 px-2"
            >
              {task.userId ? (
                <Avatar className="h-[18px] w-[18px]">
                  <AvatarImage
                    src={assignee?.user?.image ?? ""}
                    alt={assignee?.user?.name || ""}
                  />
                  <AvatarFallback className="text-[10px] font-medium border border-border/30 flex-shrink-0 h-[18px] w-[18px]">
                    {assignee?.user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div
                  className="w-[18px] h-[18px] rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0"
                  title="Unassigned"
                >
                  <span className="text-[9px] font-medium">?</span>
                </div>
              )}
              <span className="text-xs font-semibold truncate max-w-[100px]">
                {assignee?.user?.name || task.assigneeName || "Unassigned"}
              </span>
            </Button>
          </TaskAssigneePopover>
        )}
        {task && (
          <TaskDueDatePopover task={task}>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-8 px-2"
            >
              {task.dueDate ? (
                <>
                  {getDueDateStatus(task.dueDate) === "overdue" && (
                    <CalendarX
                      className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                    />
                  )}
                  {getDueDateStatus(task.dueDate) === "due-soon" && (
                    <CalendarClock
                      className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                    />
                  )}
                  {(getDueDateStatus(task.dueDate) === "far-future" ||
                    getDueDateStatus(task.dueDate) === "no-due-date") && (
                    <Calendar
                      className={`w-3.5 h-3.5 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                    />
                  )}
                  <span className="text-xs font-semibold">
                    {format(new Date(task.dueDate), "MMM d")}
                  </span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    No date
                  </span>
                </>
              )}
            </Button>
          </TaskDueDatePopover>
        )}
      </div>

      <div className="hidden lg:block w-full h-[1px] bg-border my-2" />

      <div className="hidden lg:flex px-3 lg:px-4 pb-3 lg:pb-4 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground px-2">
            Labels
          </span>
          <div className="flex flex-wrap items-center gap-1.5 px-2">
            {task &&
              taskLabels.length > 0 &&
              taskLabels.map(
                (label: { id: string; name: string; color: string }) => (
                  <TaskLabelsPopover
                    key={`edit-${label.id}`}
                    task={task}
                    workspaceId={workspaceId}
                  >
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 px-1.5 py-0.5 cursor-pointer hover:bg-accent/50 transition-colors text-[10px]"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            labelColors.find((c) => c.value === label.color)
                              ?.color || "#94a3b8",
                        }}
                      />
                      <span className="truncate max-w-[60px]">
                        {label.name}
                      </span>
                    </Badge>
                  </TaskLabelsPopover>
                ),
              )}

            {task && (
              <TaskLabelsPopover task={task} workspaceId={workspaceId}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 rounded-full"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TaskLabelsPopover>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
