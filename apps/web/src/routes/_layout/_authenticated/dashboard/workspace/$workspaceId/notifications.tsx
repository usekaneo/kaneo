import { createFileRoute } from "@tanstack/react-router";
import { Bell, Inbox, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import NotificationItem from "@/components/notification/notification-item";
import { notificationMatchesWorkspace } from "@/components/notification/notification-utils";
import PageTitle from "@/components/page-title";
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
import { ErrorDisplay } from "@/components/ui/error-display";
import { Skeleton } from "@/components/ui/skeleton";
import useClearNotifications from "@/hooks/mutations/notification/use-clear-notifications";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useBrowserNotificationPermission from "@/hooks/use-browser-notification-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/notifications",
)({
  component: RouteComponent,
});

const notificationSkeletonKeys = [
  "notification-skeleton-1",
  "notification-skeleton-2",
  "notification-skeleton-3",
  "notification-skeleton-4",
] as const;

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const {
    data: notifications,
    error,
    isLoading,
    refetch,
  } = useGetNotifications();
  const { mutate: markAllAsRead, isPending: isMarkingAllRead } =
    useMarkAllNotificationsAsRead();
  const { mutate: clearAll, isPending: isClearingAll } =
    useClearNotifications();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const {
    supported: isDesktopNotificationsSupported,
    permission: desktopNotificationPermission,
    requestPermission,
  } = useBrowserNotificationPermission();

  const workspaceNotifications = useMemo(
    () =>
      (notifications ?? []).filter((notification) =>
        notificationMatchesWorkspace(notification, workspaceId),
      ),
    [notifications, workspaceId],
  );

  const unreadCount = workspaceNotifications.filter(
    (item) => !item.isRead,
  ).length;

  if (error) {
    return (
      <>
        <PageTitle title={t("workspace:notifications.pageTitle")} />
        <WorkspaceLayout title={t("workspace:notifications.pageTitle")}>
          <ErrorDisplay
            error={error}
            onRetry={() => {
              void refetch();
            }}
          />
        </WorkspaceLayout>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageTitle title={t("workspace:notifications.pageTitle")} />
        <WorkspaceLayout title={t("workspace:notifications.pageTitle")}>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-4 border-b border-border/60 pb-5">
              <div className="space-y-2">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-96 max-w-full" />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-36 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>

            <div className="space-y-3">
              {notificationSkeletonKeys.map((key) => (
                <Skeleton key={key} className="h-28 w-full rounded-3xl" />
              ))}
            </div>
          </div>
        </WorkspaceLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("workspace:notifications.pageTitle")} />
      <WorkspaceLayout title={t("workspace:notifications.pageTitle")}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
          <section className="space-y-4 border-b border-border/60 pb-5">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                {t("workspace:notifications.heading")}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("workspace:notifications.subtitle")}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{unreadCount}</span>
                  <span className="text-muted-foreground">
                    {t("workspace:notifications.summary.unread")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {workspaceNotifications.length}
                  </span>
                  <span className="text-muted-foreground">
                    {t("workspace:notifications.summary.total")}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsRead()}
                  disabled={
                    isMarkingAllRead || workspaceNotifications.length === 0
                  }
                >
                  {t("common:actions.markAllRead")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowClearDialog(true)}
                  disabled={
                    isClearingAll || workspaceNotifications.length === 0
                  }
                >
                  {t("notifications:clearAll")}
                </Button>
              </div>
            </div>
          </section>

          {isDesktopNotificationsSupported && (
            <section className="rounded-[1.75rem] border border-border/70 bg-muted/20 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {desktopNotificationPermission === "denied"
                      ? t("workspace:notifications.desktop.blockedTitle")
                      : desktopNotificationPermission === "granted"
                        ? t("workspace:notifications.desktop.enabledTitle")
                        : t("workspace:notifications.desktop.enableTitle")}
                  </h3>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {desktopNotificationPermission === "denied"
                      ? t("workspace:notifications.desktop.blockedDescription")
                      : desktopNotificationPermission === "granted"
                        ? t(
                            "workspace:notifications.desktop.enabledDescription",
                          )
                        : t(
                            "workspace:notifications.desktop.enableDescription",
                          )}
                  </p>
                </div>

                {desktopNotificationPermission === "default" && (
                  <Button size="sm" onClick={() => void requestPermission()}>
                    {t("workspace:notifications.desktop.enableAction")}
                  </Button>
                )}
              </div>
            </section>
          )}

          {workspaceNotifications.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-muted/50 text-muted-foreground ring-8 ring-muted/20">
                <Bell className="h-10 w-10 opacity-60" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight">
                {t("workspace:notifications.emptyTitle")}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {t("workspace:notifications.emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {workspaceNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  showReadAction
                  workspaceId={workspaceId}
                />
              ))}
            </div>
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
              <AlertDialogClose>
                <Button variant="outline" size="sm">
                  {t("common:actions.cancel")}
                </Button>
              </AlertDialogClose>
              <AlertDialogClose
                onClick={() => {
                  clearAll();
                  setShowClearDialog(false);
                }}
              >
                <Button variant="destructive" size="sm">
                  {t("common:actions.clearAll")}
                </Button>
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WorkspaceLayout>
    </>
  );
}
