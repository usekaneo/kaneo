import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import useClearReadNotifications from "@/hooks/mutations/notification/use-clear-read-notifications";
import useDeleteNotification from "@/hooks/mutations/notification/use-delete-notification";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import useMarkNotificationAsUnread from "@/hooks/mutations/notification/use-mark-notification-as-unread";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { toast } from "@/lib/toast";
import type { Notification } from "@/types/notification";

type InboxShortcutsOptions = {
  workspaceId: string;
  notifications: Notification[];
  order: Notification[];
  selectedId: string | undefined;
  onSelect: (notification: Notification) => void;
};

function focusNotification(id: string) {
  const element = document.querySelector<HTMLElement>(
    `[data-notification-id="${id}"]`,
  );
  element?.focus({ preventScroll: true });
  element?.scrollIntoView?.({ block: "nearest" });
}

export function useInboxShortcuts({
  workspaceId,
  notifications,
  order,
  selectedId,
  onSelect,
}: InboxShortcutsOptions) {
  const { t } = useTranslation();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const { mutate: markAsUnread } = useMarkNotificationAsUnread();
  const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead(workspaceId);
  const { mutateAsync: deleteNotification } = useDeleteNotification();
  const { mutateAsync: clearRead } = useClearReadNotifications(workspaceId);

  const index = order.findIndex(
    (notification) => notification.id === selectedId,
  );
  const selected = order[index];

  const select = (notification: Notification | undefined) => {
    if (!notification) return;
    onSelect(notification);
    focusNotification(notification.id);
  };

  useShortcut("nextTask", () =>
    select(order[index === -1 ? 0 : Math.min(index + 1, order.length - 1)]),
  );
  useShortcut("previousTask", () =>
    select(order[index === -1 ? order.length - 1 : Math.max(index - 1, 0)]),
  );

  useShortcut(
    "toggleNotificationRead",
    () => {
      if (!selected) return;
      if (selected.isRead) markAsUnread(selected.id);
      else markAsRead(selected.id);
    },
    { enabled: Boolean(selected) },
  );
  useShortcut("markAllNotificationsRead", () => markAllAsRead(), {
    enabled: notifications.some((notification) => !notification.isRead),
  });

  useShortcut(
    "deleteNotification",
    async () => {
      if (!selected) return;
      const next = order[index + 1] ?? order[index - 1];
      try {
        await deleteNotification(selected.id);
        select(next);
      } catch {
        toast.error(t("notifications:inbox.actionError"));
      }
    },
    { enabled: Boolean(selected) },
  );
  useShortcut(
    "deleteReadNotifications",
    async () => {
      try {
        await clearRead();
        toast.message(t("notifications:inbox.readCleared"), {
          icon: Trash2Icon,
        });
      } catch {
        toast.error(t("notifications:inbox.actionError"));
      }
    },
    { enabled: notifications.some((notification) => notification.isRead) },
  );
}
