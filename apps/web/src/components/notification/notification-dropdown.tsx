import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationItem from "@/components/notification/notification-item";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";

export type NotificationDropdownRef = {
  toggle: () => void;
};

const NotificationDropdown = forwardRef<NotificationDropdownRef>(
  (_props, ref) => {
    const { t } = useTranslation();
    const { data: notifications } = useGetNotifications();
    const { data: workspace } = useActiveWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const [showClearDialog, setShowClearDialog] = useState(false);

    const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead();
    const { mutate: clearAll } = useClearNotifications();

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
                      <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive" />
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

          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/10">
              <h3 className="font-semibold text-sm tracking-tight">
                {t("notifications:title")}
              </h3>
              {unreadNotifications.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {t("notifications:newCount", {
                      count: unreadNotifications.length,
                    })}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsRead()}
                    className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                  >
                    {t("common:actions.markAllRead")}
                  </Button>
                </div>
              )}
            </div>

            <div className="relative max-h-96 overflow-y-auto">
              {!hasNotifications ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 border border-border/40">
                    <Bell className="h-6 w-6 opacity-40" />
                  </div>
                  <p className="font-medium text-foreground">
                    {t("notifications:emptyTitle")}
                  </p>
                  <p className="text-xs mt-1">
                    {t("notifications:emptySubtitle")}
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    compact
                    notification={notification}
                    onSelect={() => setIsOpen(false)}
                    workspaceId={workspace?.id}
                  />
                ))
              )}
            </div>
            {hasNotifications && (
              <div className="border-t border-border/40 p-2 bg-muted/10">
                <div className="flex items-center gap-2">
                  {workspace && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      render={
                        <Link
                          to="/dashboard/workspace/$workspaceId/notifications"
                          params={{ workspaceId: workspace.id }}
                          onClick={() => setIsOpen(false)}
                        />
                      }
                    >
                      {t("notifications:viewAll")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                    className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {t("notifications:clearAll")}
                  </Button>
                </div>
              </div>
            )}
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
