import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import messages from "../../../../../i18n/en-US.json";
import type { AssignedTask } from "./assigned-tasks";
import { DueDateText } from "./due-date-text";
import { MOCK_ACTIVITY } from "./mock-activity";
import type { PreviewNotification } from "./mock-inbox";
import { NotificationIcon } from "./notification-icon";
import { formatRelativeTime } from "./relative-time";

const copy = messages.notifications.inbox;

// apps/web's inbox detail: the notification, then the task it points at.
export function InboxDetail({
  notification,
  task,
  onOpenTask,
}: {
  notification: PreviewNotification;
  task: AssignedTask | undefined;
  onOpenTask: (task: AssignedTask) => void;
}) {
  const activity = MOCK_ACTIVITY.filter(
    (entry) => entry.taskId === notification.taskId,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-8">
        <time
          dateTime={notification.createdAt}
          className="text-xs text-muted-foreground"
        >
          {formatRelativeTime(notification.createdAt)}
        </time>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full max-w-3xl flex-col gap-7 px-8 py-8">
          <div className="flex gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
            <NotificationIcon type={notification.type} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[13px] font-medium text-foreground">
                {notification.title}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {notification.content}
              </p>
            </div>
          </div>

          {task ? (
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-foreground">
                    {task.title}
                  </h2>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => onOpenTask(task)}
                  >
                    {copy.openTask}
                    <ArrowUpRight />
                  </Button>
                </div>
                <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-foreground/85">
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">{messages.tasks.status.label}</dt>
                    <dd className="flex items-center gap-1.5">
                      {getColumnIcon(task.status)}
                      {task.statusName}
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">{messages.tasks.priority.label}</dt>
                    <dd className="flex items-center gap-1.5 [&_svg]:size-3.5">
                      {getPriorityIcon(task.priority ?? "")}
                      {
                        messages.tasks.priority[
                          (task.priority ??
                            "no-priority") as keyof typeof messages.tasks.priority
                        ]
                      }
                    </dd>
                  </div>
                  {task.dueDate && (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">
                        {messages.tasks.dueDate.label}
                      </dt>
                      <dd>
                        <DueDateText
                          dueDate={task.dueDate}
                          className="text-[13px]"
                        />
                      </dd>
                    </div>
                  )}
                  {task.assigneeName && (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">
                        {messages.tasks.assignee.label}
                      </dt>
                      <dd>{task.assigneeName}</dd>
                    </div>
                  )}
                </dl>
                <p className="text-sm leading-6 text-foreground/85">
                  {task.description}
                </p>
              </div>

              {activity.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-border/60 pt-5">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    {copy.recentActivity}
                  </h3>
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-1">
                      <p className="text-[13px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {entry.actorName}
                        </span>{" "}
                        {entry.action}
                        <span aria-hidden="true"> · </span>
                        <time dateTime={entry.createdAt}>
                          {formatRelativeTime(entry.createdAt)}
                        </time>
                      </p>
                      {entry.comment && (
                        <p className="rounded-lg border border-border/70 px-3 py-2 text-[13px] text-foreground/85">
                          {entry.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {copy.taskUnavailable}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
