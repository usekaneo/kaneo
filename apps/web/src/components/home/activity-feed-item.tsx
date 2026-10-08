import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { WorkspaceActivity } from "@/fetchers/activity/get-workspace-activities";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { describeActivity } from "./describe-activity";

type ActivityFeedItemProps = {
  activity: WorkspaceActivity;
  workspaceId: string;
};

export function ActivityFeedItem({
  activity,
  workspaceId,
}: ActivityFeedItemProps) {
  const { t } = useTranslation();
  const actorName =
    activity.userName ||
    activity.externalUserName ||
    t("common:people.someone");

  return (
    <li className="flex gap-2.5">
      <Avatar className="size-6 shrink-0">
        <AvatarImage
          src={activity.userImage ?? activity.externalUserAvatar ?? ""}
          alt=""
        />
        <AvatarFallback className="border border-border/30 font-medium text-[10px]">
          {getInitials(actorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] text-muted-foreground leading-[18px]">
          <span className="font-medium text-foreground">{actorName}</span>{" "}
          {describeActivity(activity, t)}
        </p>
        {activity.type === "comment" && activity.excerpt && (
          <p className="line-clamp-3 rounded-lg bg-muted/70 px-2.5 py-2 text-[13px] text-foreground/85 leading-[18px]">
            {activity.excerpt}
          </p>
        )}
        <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{
              workspaceId,
              projectId: activity.projectId,
              taskId: activity.taskId,
            }}
            className="min-w-0 truncate hover:text-foreground"
          >
            <span className="font-medium">
              {activity.taskNumber == null
                ? activity.projectSlug
                : `${activity.projectSlug}-${activity.taskNumber}`}
            </span>{" "}
            {activity.taskTitle}
          </Link>
          <span aria-hidden="true">·</span>
          <time
            dateTime={activity.createdAt}
            title={formatDateTime(activity.createdAt)}
            className="shrink-0"
          >
            {formatRelativeTime(activity.createdAt)}
          </time>
        </p>
      </div>
    </li>
  );
}
