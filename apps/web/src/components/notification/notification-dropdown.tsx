import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import useClearNotifications from "@/hooks/mutations/notification/use-clear-notifications";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { getStatusLabel } from "@/lib/i18n/domain";
import type { Notification } from "@/types/notification";

export type NotificationDropdownRef = {
  toggle: () => void;
};

function getEventDataRecord(
  eventData: unknown,
): Record<string, unknown> | null {
  if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
    return null;
  }

  return eventData as Record<string, unknown>;
}

function getReminderLeadTime(
  eventData: Record<string, unknown>,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const minutes = Number(eventData.leadTimeMinutes ?? 1440);
  if (minutes % 1440 === 0) {
    return t("notifications:reminderLeadTime.days", {
      count: minutes / 1440,
    });
  }
  if (minutes % 60 === 0) {
    return t("notifications:reminderLeadTime.hours", {
      count: minutes / 60,
    });
  }
  return t("notifications:reminderLeadTime.minutes", { count: minutes });
}

export function getNotificationTitle(
  notification: Notification,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const eventData = getEventDataRecord(notification.eventData);
  if (eventData) {
    switch (notification.type) {
      case "task_created":
        return t("notifications:events.task_created.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "workspace_created":
        return t("notifications:events.workspace_created.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_status_changed":
        return t("notifications:events.task_status_changed.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_assignee_changed":
        return t("notifications:events.task_assignee_changed.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "time_entry_created":
        return t("notifications:events.time_entry_created.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_mention":
        return t("notifications:events.task_mention.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_comment":
        return t("notifications:events.task_comment.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "due_date_reminder":
        return t("notifications:events.due_date_reminder.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      case "task_overdue":
        return t("notifications:events.task_overdue.title", {
          ...eventData,
          defaultValue: notification.title ?? notification.type,
        });
      default:
        break;
    }
  }

  return notification.title ?? notification.type;
}

export function getNotificationContent(
  notification: Notification,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const eventData = getEventDataRecord(notification.eventData);
  if (eventData) {
    switch (notification.type) {
      case "task_created":
        return t("notifications:events.task_created.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "workspace_created":
        return t("notifications:events.workspace_created.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "task_status_changed":
        return t("notifications:events.task_status_changed.content", {
          ...eventData,
          oldStatus: getStatusLabel(String(eventData.oldStatus ?? "")),
          newStatus: getStatusLabel(String(eventData.newStatus ?? "")),
          defaultValue: notification.content ?? "",
        });
      case "task_assignee_changed":
        return t("notifications:events.task_assignee_changed.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "time_entry_created":
        return eventData.taskTitle
          ? t("notifications:events.time_entry_created.contentWithTask", {
              ...eventData,
              defaultValue: notification.content ?? "",
            })
          : t("notifications:events.time_entry_created.contentWithoutTask", {
              ...eventData,
              defaultValue: notification.content ?? "",
            });
      case "task_mention":
        return t("notifications:events.task_mention.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "task_comment":
        return t("notifications:events.task_comment.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      case "due_date_reminder":
        return t("notifications:events.due_date_reminder.content", {
          ...eventData,
          leadTime: getReminderLeadTime(eventData, t),
          defaultValue: notification.content ?? "",
        });
      case "task_overdue":
        return t("notifications:events.task_overdue.content", {
          ...eventData,
          defaultValue: notification.content ?? "",
        });
      default:
        break;
    }
  }

  return notification.content ?? "";
}

const NotificationDropdown = forwardRef<NotificationDropdownRef>(
  (_props, ref) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data: notifications } = useGetNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [showClearDialog, setShowClearDialog] = useState(false);

    const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead();
    const { mutate: clearAll } = useClearNotifications();
    const { mutate: markAsRead } = useMarkNotificationAsRead();

    const handleNotificationClick = useCallback(
      (notification: Notification) => {
        if (!notification.isRead) {
          markAsRead(notification.id);
        }

        const ed = getEventDataRecord(notification.eventData);
        const workspaceId =
          typeof ed?.workspaceId === "string" ? ed.workspaceId : null;
        const projectId =
          typeof ed?.projectId === "string" ? ed.projectId : null;
        const taskId = notification.resourceId ?? null;

        if (
          notification.resourceType === "task" &&
          workspaceId &&
          projectId &&
          taskId
        ) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: { workspaceId, projectId, taskId },
          });
        }
      },
      [markAsRead, navigate],
    );

    const unreadNotifications = notifications?.filter((n) => !n.isRead) || [];
    const hasNotifications = notifications && notifications.length > 0;

    useImperativeHandle(ref, () => ({
      toggle: () => setIsOpen(!isOpen),
    }));

    const handleClearAll = () => {
      clearAll();
      setShowClearDialog(false);
    };

    useRegisterShortcuts({
      sequentialShortcuts: {
        [shortcuts.notification.prefix]: {
          [shortcuts.notification.open]: () => setIsOpen(!isOpen),
        },
      },
    });

    return (
      <>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-9 w-9 p-0"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadNotifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold leading-none text-white transition-[scale,opacity] duration-200 ease-out starting:scale-75 starting:opacity-0 motion-reduce:starting:scale-100">
                        {unreadNotifications.length > 99
                          ? "99+"
                          : unreadNotifications.length}
                      </span>
                    )}
                    <span className="sr-only">
                      {t("navigation:notifications")}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-2">
                  <KbdSequence
                    keys={[
                      shortcuts.notification.prefix,
                      shortcuts.notification.open,
                    ]}
                    description={t("notifications:shortcuts.open")}
                  />
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenuContent align="end" className="w-88 p-0">
            <div className="overflow-hidden rounded-lg">
              <div className="flex h-10 items-center justify-between border-border/50 border-b pr-2 pl-3">
                <h3 className="font-medium text-sm">
                  {t("notifications:title")}
                </h3>
                {unreadNotifications.length > 0 && (
                  <DropdownMenuItem
                    closeOnClick={false}
                    onClick={() => markAllAsRead()}
                    className="w-auto cursor-pointer rounded-md px-2 py-1 text-muted-foreground text-xs data-highlighted:text-foreground"
                  >
                    {t("common:actions.markAllRead")}
                  </DropdownMenuItem>
                )}
              </div>

              <div className="relative max-h-80 overflow-y-auto p-1">
                {!hasNotifications ? (
                  <div className="flex flex-col items-center gap-1 py-10 text-center">
                    <Bell className="mb-1 size-5 text-muted-foreground/40" />
                    <p className="text-muted-foreground text-sm">
                      {t("notifications:emptyTitle")}
                    </p>
                    <p className="text-muted-foreground/60 text-xs">
                      {t("notifications:emptySubtitle")}
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const content = getNotificationContent(notification, t);
                    return (
                      <DropdownMenuItem
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className="cursor-pointer items-start rounded-md px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                notification.isRead
                                  ? "text-muted-foreground"
                                  : "font-medium text-foreground",
                              )}
                            >
                              {getNotificationTitle(notification, t)}
                            </span>
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">
                              {formatRelativeTime(notification.createdAt)}
                            </span>
                            {!notification.isRead && (
                              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          {content && (
                            <p
                              className={cn(
                                "mt-0.5 line-clamp-1 text-xs",
                                notification.isRead
                                  ? "text-muted-foreground/60"
                                  : "text-muted-foreground",
                              )}
                            >
                              {content}
                            </p>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                )}
              </div>
              {hasNotifications && (
                <div className="border-border/50 border-t p-1">
                  <DropdownMenuItem
                    onClick={() => setShowClearDialog(true)}
                    className="cursor-pointer justify-center rounded-md px-2 py-1.5 text-muted-foreground text-xs data-highlighted:text-destructive"
                  >
                    {t("notifications:clearAll")}
                  </DropdownMenuItem>
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("notifications:clearDialogTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("notifications:clearDialogDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose>
                <Button variant="outline" size="sm">
                  {t("common:actions.cancel")}
                </Button>
              </AlertDialogClose>
              <AlertDialogClose onClick={handleClearAll}>
                <Button variant="destructive" size="sm">
                  {t("common:actions.clearAll")}
                </Button>
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  },
);

NotificationDropdown.displayName = "NotificationDropdown";

export default NotificationDropdown;
