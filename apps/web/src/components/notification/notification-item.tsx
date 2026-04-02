import { useNavigate } from "@tanstack/react-router";
import {
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MessageSquareText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import type { Notification } from "@/types/notification";
import {
  focusNotificationComment,
  getNotificationContent,
  getNotificationProjectName,
  getNotificationTarget,
  getNotificationTitle,
} from "./notification-utils";

type NotificationItemProps = {
  compact?: boolean;
  notification: Notification;
  onSelect?: () => void;
  showReadAction?: boolean;
  workspaceId?: string;
};

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "task_assignee_changed":
      return BriefcaseBusiness;
    case "task_comment_created":
      return MessageSquareText;
    case "task_status_changed":
      return CheckCircle2;
    case "time_entry_created":
      return Clock3;
    default:
      return BellRing;
  }
}

export default function NotificationItem({
  compact = false,
  notification,
  onSelect,
  showReadAction = false,
  workspaceId,
}: NotificationItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: markAsRead } = useMarkNotificationAsRead();
  const NotificationIcon = getNotificationIcon(notification.type);
  const projectName = getNotificationProjectName(notification);

  const handleOpen = async () => {
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    const target = getNotificationTarget(notification, workspaceId);

    if (target?.kind === "task") {
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
        params: {
          workspaceId: target.workspaceId,
          projectId: target.projectId,
        },
        search: {
          taskId: target.taskId,
        },
      });
      focusNotificationComment(target.commentId);
    }

    if (target?.kind === "workspace") {
      navigate({
        to: "/dashboard/workspace/$workspaceId/my-tasks",
        params: {
          workspaceId: target.workspaceId,
        },
      });
    }

    onSelect?.();
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 transition-all duration-200",
        compact
          ? "rounded-none border-x-0 border-t-0 bg-transparent"
          : "bg-background/70 hover:border-border/80 hover:bg-background/90",
        !notification.isRead && "border-primary/15 bg-primary/5",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3",
          compact ? "px-3 py-3" : "px-4 py-4",
        )}
      >
        <button
          type="button"
          onClick={handleOpen}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div
            className={cn(
              "mt-0.5 flex shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground",
              compact ? "h-9 w-9" : "h-10 w-10",
              !notification.isRead &&
                "border-primary/20 bg-primary/10 text-primary",
            )}
          >
            <NotificationIcon className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {getNotificationTitle(notification, t)}
                </h4>
                {!notification.isRead && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>

              {getNotificationContent(notification, t) && (
                <p
                  className={cn(
                    "text-muted-foreground",
                    compact ? "line-clamp-2 text-xs" : "text-sm leading-5",
                  )}
                >
                  {getNotificationContent(notification, t)}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80">
              {projectName && (
                <Badge
                  variant="outline"
                  size="sm"
                  className="rounded-md bg-muted/30 px-2 font-medium"
                >
                  {projectName}
                </Badge>
              )}
              <span>{formatRelativeTime(notification.createdAt)}</span>
            </div>
          </div>
        </button>

        {!compact && showReadAction && !notification.isRead && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-0.5 h-7 px-2 text-xs text-muted-foreground"
            onClick={async () => {
              try {
                await markAsRead(notification.id);
              } catch (error) {
                console.error("Failed to mark notification as read:", error);
              }
            }}
          >
            {t("notifications:markRead")}
          </Button>
        )}
      </div>
    </div>
  );
}
