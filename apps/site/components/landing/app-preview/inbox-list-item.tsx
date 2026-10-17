import { cn } from "@/lib/utils";
import messages from "../../../../../i18n/en-US.json";
import type { PreviewNotification } from "./mock-inbox";
import { NotificationIcon } from "./notification-icon";
import { formatRelativeTime } from "./relative-time";

export function InboxListItem({
  notification,
  isSelected,
  onSelect,
}: {
  notification: PreviewNotification;
  isSelected: boolean;
  onSelect: (notification: PreviewNotification) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-tour-target={
          notification.id === "n-1" ? "inbox-notification" : undefined
        }
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
              {notification.title}
            </span>
            <time
              dateTime={notification.createdAt}
              className="shrink-0 text-xs text-muted-foreground"
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
                  {messages.notifications.inbox.unread}
                </span>
              )}
            </span>
          </span>
          <span
            className={cn(
              "truncate text-[13px]",
              notification.isRead
                ? "text-muted-foreground/80"
                : "text-muted-foreground",
            )}
          >
            {notification.content}
          </span>
        </span>
      </button>
    </li>
  );
}
