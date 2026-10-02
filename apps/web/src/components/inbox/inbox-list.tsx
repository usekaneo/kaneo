import { CheckCheck, Inbox, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import useClearNotifications from "@/hooks/mutations/notification/use-clear-notifications";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import type { Notification } from "@/types/notification";
import {
  filterNotifications,
  groupNotifications,
  type InboxFilter,
} from "./group-notifications";
import { InboxListItem } from "./inbox-list-item";

type InboxListProps = {
  workspaceId: string;
  notifications: Notification[];
  selectedId: string | undefined;
  onSelect: (notification: Notification) => void;
};

export function InboxList({
  workspaceId,
  notifications,
  selectedId,
  onSelect,
}: InboxListProps) {
  const { t } = useTranslation();
  const day = useLocalDay();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead(workspaceId);
  const { mutate: clearAll } = useClearNotifications(workspaceId);

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;
  const { today, earlier } = useMemo(
    () =>
      groupNotifications(
        filterNotifications(notifications, filter),
        new Date(day),
      ),
    [notifications, filter, day],
  );

  const filters: Array<{ value: InboxFilter; label: string; count?: number }> =
    [
      { value: "all", label: t("notifications:inbox.filters.all") },
      {
        value: "unread",
        label: t("notifications:inbox.filters.unread"),
        count: unreadCount,
      },
      { value: "mentions", label: t("notifications:inbox.filters.mentions") },
    ];

  const groups = [
    { id: "today", title: t("notifications:inbox.today"), items: today },
    { id: "earlier", title: t("notifications:inbox.earlier"), items: earlier },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-border/60 border-b px-3">
        <fieldset className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
          <legend className="sr-only">
            {t("notifications:inbox.filters.label")}
          </legend>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "flex h-6.5 cursor-pointer items-center gap-1.5 rounded-md px-2.5 font-medium text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                filter === option.value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
              {option.count ? (
                <span className="font-normal text-muted-foreground text-xs tabular-nums">
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
            onClick={() => markAllAsRead()}
            className="text-muted-foreground"
          >
            <CheckCheck />
            {t("common:actions.markAllRead")}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={notifications.length === 0}
            onClick={() => setShowClearDialog(true)}
            className="text-muted-foreground"
            title={t("notifications:clearAll")}
          >
            <Trash2 />
            <span className="sr-only">{t("notifications:clearAll")}</span>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <Inbox className="mb-1 size-5 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              {notifications.length === 0
                ? t("notifications:emptyTitle")
                : t("notifications:inbox.emptyFilter")}
            </p>
            {notifications.length === 0 && (
              <p className="text-muted-foreground/70 text-xs">
                {t("notifications:emptySubtitle")}
              </p>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.id}>
              <h2 className="px-5 pt-3.5 pb-1.5 font-medium text-muted-foreground text-xs">
                {group.title}
              </h2>
              <ul className="flex flex-col gap-0.5 px-2">
                {group.items.map((notification) => (
                  <InboxListItem
                    key={notification.id}
                    notification={notification}
                    isSelected={notification.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

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
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => clearAll()}
                />
              }
            >
              {t("common:actions.clearAll")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
