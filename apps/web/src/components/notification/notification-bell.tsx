import { Button } from "@/components/ui/button";
import useClearNotifications from "@/hooks/mutations/notification/use-clear-notifications";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import { cn } from "@/lib/cn";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import NotificationItem from "./notification-item";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications = [], isLoading } = useGetNotifications();
  const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead();
  const { mutate: clearAllNotifications } = useClearNotifications();

  const unreadCount = notifications?.filter(
    (notification) => notification.isRead === false,
  ).length;

  const handleMarkAllAsRead = () => {
    markAllAsRead(undefined, {
      onSuccess: () => {
        toast.success("All notifications marked as read");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to mark notifications as read",
        );
      },
    });
  };

  const handleClearAllNotifications = () => {
    clearAllNotifications(undefined, {
      onSuccess: () => {
        toast.success("All notifications cleared");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to clear notifications",
        );
      },
    });
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-full"
        >
          <Bell className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-lg border border-zinc-200 bg-white p-0 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Notifications
                </h3>
                <div className="flex gap-2">
                  {notifications.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        onClick={handleClearAllNotifications}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear all
                      </Button>
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                          onClick={handleMarkAllAsRead}
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Mark read
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700",
                  notifications.length === 0 && "overflow-hidden",
                )}
              >
                {isLoading ? (
                  <div className="flex h-20 items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
                      <Bell className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <p className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      No notifications
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      You're all caught up!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {notifications &&
                      notifications.length > 0 &&
                      notifications.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onClose={() => setIsOpen(false)}
                        />
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
