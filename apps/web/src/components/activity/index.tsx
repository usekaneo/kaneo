import { formatDistanceToNow } from "date-fns";
import { Calendar, CircleAlert, History, UserRound } from "lucide-react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/preview-card";
import { TimelineContent, TimelineItem } from "../ui/timeline";
import CommentCard from "./comment-card";
import { isCommentActivity } from "./utils";

type ActivityItem = {
  type: string;
  content: string | null;
  id: string;
  createdAt: string;
  userId: string | null;
  taskId: string;
  externalUserName?: string | null;
  externalUserAvatar?: string | null;
  externalSource?: string | null;
  externalUrl?: string | null;
};

type WorkspaceUser = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

function getActivityTypeIcon(type: string) {
  const iconClass = "h-4 w-4";
  switch (type) {
    case "status_changed":
      return <History className={iconClass} />;
    case "priority_changed":
      return <CircleAlert className={iconClass} />;
    case "due_date_changed":
      return <Calendar className={iconClass} />;
    case "assignee_changed":
    case "unassigned":
      return <UserRound className={iconClass} />;
    default:
      return <History className={iconClass} />;
  }
}

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatActivityDateText(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slashMatch) return value;
  const [, month, day, year] = slashMatch;
  const fromSlashDate = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(fromSlashDate.getTime())) return value;
  return fromSlashDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function findUserByName(users: WorkspaceUser[] | undefined, name: string) {
  if (!users) return null;
  const matches = users.filter(
    (member) =>
      member.user?.name?.toLowerCase().trim() === name.toLowerCase().trim(),
  );

  if (matches.length !== 1) return null;
  return matches[0];
}

function UserHoverName({
  user,
  fallbackName,
}: {
  user: WorkspaceUser | null;
  fallbackName: string;
}) {
  if (!user?.user) {
    return <span className="font-medium text-foreground">{fallbackName}</span>;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span className="cursor-pointer font-medium text-foreground transition-colors hover:text-primary">
          {user.user.name}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-52 p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.user.image ?? ""}
              alt={user.user.name || ""}
            />
            <AvatarFallback className="bg-muted text-xs font-medium">
              {user.user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground leading-none">
              {user.user.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.user.email}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ActorAvatar({
  user,
  fallbackName,
}: {
  user: WorkspaceUser | null;
  fallbackName: string;
}) {
  return (
    <Avatar className="size-6">
      <AvatarImage src={user?.user?.image ?? ""} alt={fallbackName} />
      <AvatarFallback className="bg-muted text-[11px] font-medium">
        {fallbackName.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function renderActivityContent({
  activity,
  workspaceUsers,
}: {
  activity: ActivityItem;
  workspaceUsers: WorkspaceUser[] | undefined;
}) {
  const content = activity.content || "";

  if (activity.type === "priority_changed") {
    const match = content.match(
      /changed priority from "?(.+?)"? to "?(.+?)"?$/i,
    );
    if (!match)
      return <span className="text-sm text-muted-foreground">{content}</span>;
    return (
      <span className="text-sm text-muted-foreground">
        changed priority from{" "}
        <span className="text-foreground">{toDisplayCase(match[1])}</span> to{" "}
        <span className="text-foreground">{toDisplayCase(match[2])}</span>
      </span>
    );
  }

  if (activity.type === "status_changed") {
    const match = content.match(/changed status from "?(.+?)"? to "?(.+?)"?$/i);
    if (!match)
      return <span className="text-sm text-muted-foreground">{content}</span>;
    return (
      <span className="text-sm text-muted-foreground">
        changed status from{" "}
        <span className="text-foreground">{toDisplayCase(match[1])}</span> to{" "}
        <span className="text-foreground">{toDisplayCase(match[2])}</span>
      </span>
    );
  }

  if (activity.type === "due_date_changed") {
    const changeMatch = content.match(/changed due date from (.+) to (.+)$/i);
    if (changeMatch) {
      return (
        <span className="text-sm text-muted-foreground">
          changed due date from{" "}
          <span className="text-foreground">
            {formatActivityDateText(changeMatch[1])}
          </span>{" "}
          to{" "}
          <span className="text-foreground">
            {formatActivityDateText(changeMatch[2])}
          </span>
        </span>
      );
    }
    const setMatch = content.match(/set due date to (.+)$/i);
    if (setMatch) {
      return (
        <span className="text-sm text-muted-foreground">
          set due date to{" "}
          <span className="text-foreground">
            {formatActivityDateText(setMatch[1])}
          </span>
        </span>
      );
    }
    return <span className="text-sm text-muted-foreground">{content}</span>;
  }

  if (activity.type === "assignee_changed") {
    if (content.includes("themselves")) {
      return (
        <span className="text-sm text-muted-foreground">
          assigned the task to themselves
        </span>
      );
    }

    const tokenMatch = content.match(
      /assigned the task to \[\[user:([^|\]]+)\|([^\]]+)\]\]/,
    );
    if (tokenMatch) {
      const [, targetId, targetName] = tokenMatch;
      const targetUser =
        workspaceUsers?.find((member) => member.user?.id === targetId) || null;
      return (
        <span className="text-sm text-muted-foreground">
          assigned the task to{" "}
          <UserHoverName user={targetUser} fallbackName={targetName} />
        </span>
      );
    }

    const legacyMatch = content.match(/assigned the task to (.+)$/i);
    if (legacyMatch) {
      const targetName = legacyMatch[1];
      const targetUser = findUserByName(workspaceUsers, targetName);
      return (
        <span className="text-sm text-muted-foreground">
          assigned the task to{" "}
          <UserHoverName user={targetUser} fallbackName={targetName} />
        </span>
      );
    }
  }

  return <span className="text-sm text-muted-foreground">{content}</span>;
}

function Activity({
  activity,
  step,
  showConnector = false,
}: {
  activity: ActivityItem;
  step: number;
  showConnector?: boolean;
}) {
  const { data: workspace } = useActiveWorkspace();

  const { data: workspaceUsers } = useGetWorkspaceUsers({
    workspaceId: workspace?.id,
  });

  const user = activity.userId
    ? workspaceUsers?.find((user) => user.user?.id === activity.userId)
    : null;

  const isExternalComment = Boolean(activity.externalSource);
  const actorName = user?.user?.name || "Someone";

  if (isCommentActivity(activity)) {
    const commentUser = isExternalComment
      ? {
          id: undefined,
          name: activity.externalUserName ?? "GitHub User",
          email: undefined,
          image: activity.externalUserAvatar ?? undefined,
        }
      : {
          id: user?.user?.id,
          name: user?.user?.name,
          email: user?.user?.email,
          image: user?.user?.image,
        };

    return (
      <TimelineItem className="m-0! flex-row items-start py-2!" step={step}>
        <TimelineContent className="min-w-0 flex-1">
          <CommentCard
            commentId={activity.id}
            taskId={activity.taskId}
            content={activity.content || ""}
            user={commentUser}
            createdAt={activity.createdAt}
            externalSource={activity.externalSource}
            externalUrl={activity.externalUrl}
          />
        </TimelineContent>
      </TimelineItem>
    );
  }

  const activityIcon = getActivityTypeIcon(activity.type);

  return (
    <TimelineItem
      className="relative m-0! flex-row items-center gap-3 py-2.5!"
      step={step}
    >
      {showConnector && (
        <span className="-translate-x-1/2 absolute top-9 bottom-0 left-3 w-px bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)] dark:bg-[color-mix(in_srgb,var(--foreground)_26%,transparent)]" />
      )}
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/80">
        {activityIcon}
      </span>
      <ActorAvatar user={user || null} fallbackName={actorName} />
      <TimelineContent className="text-sm leading-6 text-foreground">
        <UserHoverName user={user || null} fallbackName={actorName} />{" "}
        {renderActivityContent({
          activity,
          workspaceUsers: workspaceUsers as WorkspaceUser[] | undefined,
        })}{" "}
        <span className="whitespace-nowrap text-muted-foreground/70 text-xs">
          {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
        </span>
      </TimelineContent>
    </TimelineItem>
  );
}

export default Activity;
