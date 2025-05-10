import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import { cn } from "@/lib/cn";
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

  const handleClick = () => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (notification.resourceId && notification.resourceType) {
      if (notification.resourceType === "task") {
        onClose?.();
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

  return (
    <div
      className={cn(
        "flex cursor-pointer gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
        !notification.isRead && "bg-blue-50/50 dark:bg-blue-900/10",
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
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
