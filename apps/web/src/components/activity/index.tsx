import { formatDistanceToNow } from "date-fns";
import { Calendar, CircleAlert, History, MessageSquare } from "lucide-react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { cn } from "@/lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";
import CommentCard from "./comment-card";

function getActivityTypeComponent(type: string) {
  const iconClass = "w-3 h-3";
  switch (type) {
    case "status_changed":
      return <History className={iconClass} />;
    case "priority_changed":
      return <CircleAlert className={iconClass} />;
    case "due_date_changed":
      return <Calendar className={iconClass} />;
    case "comment":
      return <MessageSquare className={iconClass} />;
    default:
      return <History className={iconClass} />;
  }
}

function getActivityColor() {
  return "bg-muted/30 border-border text-muted-foreground";
}

function Activity({
  activity,
  isLast = false,
}: {
  activity: {
    type: string;
    content: string | null;
    id: string;
    createdAt: string;
    userId: string;
    taskId: string;
  };
  isLast?: boolean;
}) {
  const { data: workspace } = useActiveWorkspace();

  const { data: workspaceUsers } = useGetWorkspaceUsers({
    workspaceId: workspace?.id,
  });

  const user = workspaceUsers?.find(
    (user) => user.user?.id === activity.userId,
  );

  console.log(activity);

  if (activity.type === "comment" && activity.content) {
    return (
      <div className="relative flex gap-3 py-2 last:pb-0">
        {!isLast && (
          <div className="absolute left-3 top-6 w-px h-full bg-border/40" />
        )}

        <div className="relative flex-shrink-0">
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full border",
              getActivityColor(),
            )}
          >
            {getActivityTypeComponent(activity.type)}
          </div>
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <CommentCard
            commentId={activity.id}
            taskId={activity.taskId}
            content={activity.content}
            user={{
              id: user?.user?.id,
              name: user?.user?.name,
              email: user?.user?.email,
              image: user?.user?.image,
            }}
            createdAt={activity.createdAt}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex gap-3 py-2 last:pb-0">
      {!isLast && (
        <div className="absolute left-3 top-6 w-px h-full bg-border/40" />
      )}

      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full border",
            getActivityColor(),
          )}
        >
          {getActivityTypeComponent(activity.type)}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2 pt-0.5">
        <HoverCard>
          <HoverCardTrigger asChild>
            <span className="text-sm font-medium text-foreground hover:text-primary cursor-pointer transition-colors">
              {user?.user?.name}
            </span>
          </HoverCardTrigger>
          <HoverCardContent className="w-52 p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.user?.image ?? ""}
                  alt={user?.user?.name || ""}
                />
                <AvatarFallback className="text-xs font-medium bg-muted">
                  {user?.user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-none">
                  {user?.user?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user?.user?.email}
                </p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        <span className="text-sm text-muted-foreground">
          {activity.content}
        </span>
        <span className="text-xs text-muted-foreground/60 ml-auto flex-shrink-0">
          {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}

export default Activity;
