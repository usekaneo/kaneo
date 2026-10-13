import { isSameDay } from "date-fns";
import { CheckCheck, Inbox, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import messages from "../../../../../i18n/en-US.json";
import type { AssignedTask } from "./assigned-tasks";
import { InboxDetail } from "./inbox-detail";
import { InboxListItem } from "./inbox-list-item";
import type { PreviewNotification } from "./mock-inbox";
import { PreviewPageHeader } from "./page-header";

type InboxFilter = "all" | "unread" | "mentions";

const copy = messages.notifications.inbox;

// apps/web's Inbox: the notification list beside the opened notification.
export function InboxView({
  notifications,
  onNotificationsChange,
  tasks,
  onOpenTask,
}: {
  notifications: PreviewNotification[];
  onNotificationsChange: (notifications: PreviewNotification[]) => void;
  tasks: Map<string, AssignedTask>;
  onOpenTask: (task: AssignedTask) => void;
}) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const selected = notifications.find(
    (notification) => notification.id === selectedId,
  );
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const visible = notifications.filter((notification) =>
    filter === "unread"
      ? !notification.isRead
      : filter === "mentions"
        ? notification.type === "task_mention"
        : true,
  );
  const now = new Date();
  const groups = [
    {
      id: "today",
      title: copy.today,
      items: visible.filter((item) => isSameDay(new Date(item.createdAt), now)),
    },
    {
      id: "earlier",
      title: copy.earlier,
      items: visible.filter(
        (item) => !isSameDay(new Date(item.createdAt), now),
      ),
    },
  ].filter((group) => group.items.length > 0);

  const filters: Array<{ value: InboxFilter; label: string; count?: number }> =
    [
      { value: "all", label: copy.filters.all },
      { value: "unread", label: copy.filters.unread, count: unreadCount },
      { value: "mentions", label: copy.filters.mentions },
    ];

  const select = (notification: PreviewNotification) => {
    setSelectedId(notification.id);
    if (!notification.isRead) {
      onNotificationsChange(
        notifications.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
    }
  };

  return (
    <>
      <PreviewPageHeader title={copy.pageTitle} />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[26rem] shrink-0 flex-col border-r border-border/60">
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
            <fieldset className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
              <legend className="sr-only">{copy.filters.label}</legend>
              {filters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "flex h-6.5 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    filter === option.value
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                  {option.count ? (
                    <span className="text-xs font-normal tabular-nums text-muted-foreground">
                      {option.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </fieldset>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="xs"
                disabled={unreadCount === 0}
                onClick={() =>
                  onNotificationsChange(
                    notifications.map((item) => ({ ...item, isRead: true })),
                  )
                }
                className="text-muted-foreground"
              >
                <CheckCheck />
                {messages.common.actions.markAllRead}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={notifications.length === 0}
                onClick={() => onNotificationsChange([])}
                className="text-muted-foreground"
                title={messages.notifications.clearAll}
              >
                <Trash2 />
                <span className="sr-only">
                  {messages.notifications.clearAll}
                </span>
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
                <Inbox className="mb-1 size-5 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {notifications.length === 0
                    ? messages.notifications.emptyTitle
                    : copy.emptyFilter}
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.id}>
                  <h2 className="px-5 pt-3.5 pb-1.5 text-xs font-medium text-muted-foreground">
                    {group.title}
                  </h2>
                  <ul className="flex flex-col gap-0.5 px-2">
                    {group.items.map((notification) => (
                      <InboxListItem
                        key={notification.id}
                        notification={notification}
                        isSelected={notification.id === selected?.id}
                        onSelect={select}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {selected ? (
            <InboxDetail
              notification={selected}
              task={tasks.get(selected.taskId)}
              onOpenTask={onOpenTask}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Inbox className="size-5 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {copy.selectPrompt}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
