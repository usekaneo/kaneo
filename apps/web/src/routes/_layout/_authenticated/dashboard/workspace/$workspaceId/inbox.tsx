import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { InboxDetail } from "@/components/inbox/inbox-detail";
import { InboxList } from "@/components/inbox/inbox-list";
import PageTitle from "@/components/page-title";
import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import { cn } from "@/lib/cn";
import type { Notification } from "@/types/notification";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/inbox",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { data: notifications = [] } = useGetNotifications();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const [selectedId, setSelectedId] = useState<string>();

  const selected = notifications.find(
    (notification) => notification.id === selectedId,
  );

  const handleSelect = (notification: Notification) => {
    setSelectedId(notification.id);
    if (!notification.isRead) markAsRead(notification.id);
  };

  return (
    <>
      <PageTitle title={t("notifications:inbox.pageTitle")} />
      <WorkspaceLayout title={t("notifications:inbox.pageTitle")}>
        <div className="flex h-full min-h-0">
          {/* One pane at a time below lg: the list, or the opened notification. */}
          <div
            className={cn(
              "w-full shrink-0 border-border/60 lg:block lg:w-[26rem] lg:border-r",
              selected && "hidden",
            )}
          >
            <InboxList
              notifications={notifications}
              selectedId={selected?.id}
              onSelect={handleSelect}
            />
          </div>
          <div className={cn("min-w-0 flex-1", !selected && "hidden lg:block")}>
            {selected ? (
              <InboxDetail
                notification={selected}
                onBack={() => setSelectedId(undefined)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Inbox className="size-5 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  {t("notifications:inbox.selectPrompt")}
                </p>
              </div>
            )}
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
