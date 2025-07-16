import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import type { Notification } from "@/types/notification";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderKanban,
  Info,
  MessageSquare,
  Users,
} from "lucide-react";
import { useState } from "react";

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
}

export default function NotificationItem({
  notification,
  onClose,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const [isNavigating, setIsNavigating] = useState(false);
  const { project: currentProject } = useProjectStore();
  const { workspace: currentWorkspace } = useWorkspaceStore();

  // Fetch task details if this is a task notification
  const { data: task, isLoading: isTaskLoading } = useGetTask(
    notification.resourceId || "",
  );

  // Fetch project details if the current project doesn't match the task's project
  const needsProjectFetch = task && currentProject?.id !== task.projectId;
  const { data: taskProject, isLoading: isProjectLoading } = useGetProject({
    id: needsProjectFetch && task?.projectId ? task.projectId : "",
    workspaceId: currentWorkspace?.id || "",
  });

  const handleClick = async () => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (notification.resourceId && notification.resourceType) {
      if (notification.resourceType === "task") {
        if (task && !isTaskLoading && !isProjectLoading) {
          setIsNavigating(true);
          try {
            // Use the current project if it matches, otherwise use the fetched project
            const projectToUse =
              currentProject?.id === task.projectId
                ? currentProject
                : taskProject;

            if (projectToUse) {
              navigate({
                to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                params: {
                  workspaceId: projectToUse.workspaceId,
                  projectId: task.projectId,
                  taskId: task.id,
                },
              });
              onClose?.();
            }
          } catch (error) {
            console.error("Failed to navigate to task:", error);
          } finally {
            setIsNavigating(false);
          }
        }
      } else if (notification.resourceType === "workspace") {
        navigate({
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: notification.resourceId },
        });
        onClose?.();
      }
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case "task":
        return (
          <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        );
      case "workspace":
        return (
          <FolderKanban className="h-4 w-4 text-purple-500 dark:text-purple-400" />
        );
      case "project":
        return <Users className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case "comment":
        return (
          <MessageSquare className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
        );
      case "success":
        return (
          <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
        );
      case "error":
        return (
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
        );
      case "warning":
        return (
          <AlertCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
        );
      default:
        return <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
    }
  };

  const isTaskClickable =
    notification.resourceType === "task" &&
    task &&
    !isTaskLoading &&
    !isProjectLoading &&
    (currentProject?.id === task.projectId ? true : !!taskProject);

  const isClickable =
    notification.resourceType === "workspace" || isTaskClickable;

  return (
    <div
      className={cn(
        "flex gap-3 p-3",
        isClickable &&
          "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
        !notification.isRead && "bg-blue-50/50 dark:bg-blue-900/10",
        (isTaskLoading || isProjectLoading || isNavigating) &&
          "opacity-50 cursor-wait",
      )}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          handleClick();
        }
      }}
      tabIndex={isClickable ? 0 : -1}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800",
          !notification.isRead && "bg-blue-100 dark:bg-blue-900/20",
        )}
      >
        {getIcon()}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between">
          <p
            className={cn(
              "text-sm text-zinc-900 dark:text-zinc-100",
              !notification.isRead && "font-medium",
            )}
          >
            {notification.title}
          </p>
          <span className="ml-2 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
        {notification.content && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {notification.content}
          </p>
        )}
      </div>
    </div>
  );
}
