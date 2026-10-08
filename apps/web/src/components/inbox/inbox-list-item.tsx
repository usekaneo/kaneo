import { useTranslation } from "react-i18next";
import {
  getNotificationContent,
  getNotificationTitle,
} from "@/components/notification/notification-text";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Notification } from "@/types/notification";
import { NotificationIcon } from "./notification-icon";

type InboxListItemProps = {
  notification: Notification;
  isSelected: boolean;
  onSelect: (notification: Notification) => void;
};

export function InboxListItem({
  notification,
  isSelected,
  onSelect,
}: InboxListItemProps) {
  const { t } = useTranslation();
  const content = getNotificationContent(notification, t);

  return (
    <li>
      <button
        type="button"
        aria-current={isSelected ? "true" : undefined}
        onClick={() => onSelect(notification)}
        className={cn(
          "flex w-full cursor-pointer gap-2.5 rounded-lg px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          isSelected ? "bg-accent" : "hover:bg-accent/50",
        )}
      >
        <NotificationIcon type={notification.type} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[13px]",
                notification.isRead
                  ? "text-foreground/80"
                  : "font-semibold text-foreground",
              )}
            >
              {getNotificationTitle(notification, t)}
            </span>
            <time
              dateTime={notification.createdAt}
              title={formatDateTime(notification.createdAt)}
              className="shrink-0 text-muted-foreground text-xs"
            >
              {formatRelativeTime(notification.createdAt)}
            </time>
            {/* Always takes its slot so times line up across read and unread rows. */}
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                !notification.isRead && "bg-info",
              )}
            >
              {!notification.isRead && (
                <span className="sr-only">
                  {t("notifications:inbox.unread")}
                </span>
              )}
            </span>
          </span>
          {content && (
            <span
              className={cn(
                "truncate text-[13px]",
                notification.isRead
                  ? "text-muted-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {content}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
