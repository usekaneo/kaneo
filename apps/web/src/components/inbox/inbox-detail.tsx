import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getNotificationContent,
  getNotificationTitle,
} from "@/components/notification/notification-text";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Notification } from "@/types/notification";
import { InboxTask } from "./inbox-task";
import { NotificationIcon } from "./notification-icon";

type InboxDetailProps = {
  notification: Notification;
  onBack: () => void;
  workspaceId: string;
};

export function InboxDetail({
  notification,
  onBack,
  workspaceId,
}: InboxDetailProps) {
  const { t } = useTranslation();
  const taskId =
    notification.resourceType === "task" ? notification.resourceId : null;
  const content = getNotificationContent(notification, t);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-border/60 border-b px-4 lg:px-8">
        <Button
          variant="ghost"
          size="xs"
          onClick={onBack}
          className="text-muted-foreground lg:hidden"
        >
          <ArrowLeft />
          {t("notifications:inbox.back")}
        </Button>
        <span className="hidden text-muted-foreground text-xs lg:block">
          <time
            dateTime={notification.createdAt}
            title={formatDateTime(notification.createdAt)}
          >
            {formatRelativeTime(notification.createdAt)}
          </time>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full max-w-3xl flex-col gap-7 px-4 py-8 lg:px-8">
          <div className="flex gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
            <NotificationIcon type={notification.type} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-medium text-[13px] text-foreground">
                {getNotificationTitle(notification, t)}
              </p>
              {content && (
                <p className="text-[13px] text-muted-foreground">{content}</p>
              )}
            </div>
          </div>

          {taskId && (
            <InboxTask key={taskId} taskId={taskId} workspaceId={workspaceId} />
          )}
        </div>
      </div>
    </div>
  );
}
