import { createFileRoute } from "@tanstack/react-router";
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
import Activity from "@/components/activity";
import CommentInput from "@/components/activity/comment-input";
import TaskLayout from "@/components/common/task-layout";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import TaskAssigneePopover from "@/components/task/task-assignee-popover";
import TaskDescription from "@/components/task/task-description";
import TaskDueDatePopover from "@/components/task/task-due-date-popover";
import TaskLabelsPopover from "@/components/task/task-labels-popover";
import TaskPriorityPopover from "@/components/task/task-priority-popover";
import TaskStatusPopover from "@/components/task/task-status-popover";
import TaskTitle from "@/components/task/task-title";
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
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_",
)({
  component: RouteComponent,
});

function toKebabCase(str: string | undefined) {
  return str?.replace(/ /g, "-").toLowerCase().replace(/^-|-$/g, "");
}

function toNormalCase(str: string | undefined) {
  if (!str) return str;
  return str
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function RouteComponent() {
  const { projectId, workspaceId, taskId } = Route.useParams();
  const { data: task } = useGetTask(taskId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: taskLabels = [] } = useGetLabelsByTask(taskId);
  const { data: activities = [] } = useGetActivitiesByTaskId(taskId);
  const { user } = useAuth();
  const workspaceName = workspace?.name;
  const projectSlug = project?.slug;
  const taskNumber = task?.number;

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
    navigator.clipboard.writeText(
      `${toKebabCase(workspaceName)}/${toKebabCase(projectSlug)}-${taskNumber}`,
    );
    toast.message("Task branch copied to clipboard");
  };

  return (
    <TaskLayout
      taskId={taskId}
      projectId={projectId}
      workspaceId={workspaceId}
      rightSidebar={
        <div className="w-72 bg-sidebar border-l border-border flex flex-col gap-2 sticky top-0 right-0">
          <div className="flex gap-2 p-4 px-6">
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
          <div className="flex flex-col gap-2 items-start px-4">
            {task && (
              <TaskStatusPopover task={task}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-2/4 justify-start"
                >
                  {getColumnIcon(task.status ?? "")}
                  <span className="text-xs font-semibold">
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
                  className="w-2/4 justify-start"
                >
                  {getPriorityIcon(task.priority ?? "")}
                  <span className="text-xs font-semibold">
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
                  className="w-2/4 justify-start pl-3"
                >
                  {task.userId ? (
                    <Avatar className="h-[20px] w-[20px]">
                      <AvatarImage
                        src={assignee?.user?.image ?? ""}
                        alt={assignee?.user?.name || ""}
                      />
                      <AvatarFallback className="text-xs font-medium border border-border/30 flex-shrink-0 h-[20px] w-[20px]">
                        {assignee?.user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div
                      className="w-[20px] h-[20px] rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0"
                      title="Unassigned"
                    >
                      <span className="text-[10px] font-medium">?</span>
                    </div>
                  )}
                  <span className="text-xs font-semibold flex-shrink-0">
                    {assignee?.user?.name || task.assigneeName || "Unassigned"}
                  </span>
                </Button>
              </TaskAssigneePopover>
            )}
          </div>
          <div className="w-full h-[1px] bg-border my-2" />
          <div className="px-4 pb-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground pl-2">
                  Due date
                </span>
              </div>
              {task && (
                <TaskDueDatePopover task={task}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-2/4 justify-start"
                  >
                    {task.dueDate ? (
                      <>
                        {getDueDateStatus(task.dueDate) === "overdue" && (
                          <CalendarX
                            className={`w-2 h-2 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        {getDueDateStatus(task.dueDate) === "due-soon" && (
                          <CalendarClock
                            className={`w-2 h-2 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        {(getDueDateStatus(task.dueDate) === "far-future" ||
                          getDueDateStatus(task.dueDate) === "no-due-date") && (
                          <Calendar
                            className={`w-2 h-2 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                          />
                        )}
                        <span className="text-xs font-semibold flex-shrink-0">
                          {format(new Date(task.dueDate), "MMM d, yyyy")}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold">No due date</span>
                    )}
                  </Button>
                </TaskDueDatePopover>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground pl-2">
                  Labels
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-2">
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
                          key={label.id}
                          variant="outline"
                          className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-accent/50 transition-colors"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                labelColors.find((c) => c.value === label.color)
                                  ?.color || "#94a3b8",
                            }}
                          />
                          <span className="text-xs">{label.name}</span>
                        </Badge>
                      </TaskLabelsPopover>
                    ),
                  )}

                {task && (
                  <TaskLabelsPopover task={task} workspaceId={workspaceId}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-full border-border hover:border-solid"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </TaskLabelsPopover>
                )}
              </div>
            </div>
          </div>
        </div>
      }
    >
      <PageTitle
        title={`${project?.slug}-${task?.number} ⎯ ${task?.title}`}
        hideAppName
      />
      <div className="flex flex-col h-full min-h-0 max-w-3xl mx-auto px-4 py-8 gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {project?.slug}-{task?.number}
        </p>
        <TaskTitle taskId={taskId} />
        <TaskDescription taskId={taskId} />
        <span className="text-sm font-medium text-muted-foreground h-[1px] bg-border w-full" />
        <div className="flex flex-col gap-4 pt-8">
          <h1 className="text-md font-semibold">Activity</h1>
          {user?.id && <CommentInput taskId={taskId} userId={user.id} />}
          <div className="flex flex-col">
            {activities.length === 0 && (
              <p className="text-sm font-medium text-muted-foreground">
                No activity found
              </p>
            )}
            {activities.map((activity, index) => (
              <Activity
                key={activity.id}
                activity={activity}
                isLast={index === activities.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </TaskLayout>
  );
}
