import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import messages from "../../../../../i18n/en-US.json";
import type { AssignedTask } from "./assigned-tasks";
import type { PreviewActivity } from "./mock-activity";
import { formatRelativeTime } from "./relative-time";
import { SectionHeader } from "./section-header";

// Same entries as apps/web's home/activity-feed.
export function ActivityFeed({
  activities,
  tasks,
  onTaskClick,
}: {
  activities: PreviewActivity[];
  tasks: Map<string, AssignedTask>;
  onTaskClick: (task: AssignedTask) => void;
}) {
  return (
    <section>
      <SectionHeader title={messages.workspace.home.activity.title} />
      <ul className="flex flex-col gap-4 pt-4">
        {activities.map((activity) => {
          const task = tasks.get(activity.taskId);
          if (!task) return null;

          return (
            <li key={activity.id} className="flex gap-2.5">
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className="border border-border/30 text-[10px] font-medium">
                  {activity.actorName
                    .split(" ")
                    .map((name) => name[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-[13px] leading-[18px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {activity.actorName}
                  </span>{" "}
                  {activity.action}
                </p>
                {activity.comment && (
                  <p className="line-clamp-3 rounded-lg bg-muted/70 px-2.5 py-2 text-[13px] leading-[18px] text-foreground/85">
                    {activity.comment}
                  </p>
                )}
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => onTaskClick(task)}
                    className="min-w-0 truncate text-left hover:text-foreground"
                  >
                    <span className="font-medium">
                      {task.projectSlug}-{task.number}
                    </span>{" "}
                    {task.title}
                  </button>
                  <span aria-hidden="true">·</span>
                  <time dateTime={activity.createdAt} className="shrink-0">
                    {formatRelativeTime(activity.createdAt)}
                  </time>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
