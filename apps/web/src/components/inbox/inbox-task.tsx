import { useTranslation } from "react-i18next";
import Activity from "@/components/activity";
import CommentInput from "@/components/activity/comment-input";
import { isCommentActivity } from "@/components/activity/utils";
import { DueDateText } from "@/components/my-work/due-date-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Timeline } from "@/components/ui/timeline";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

type InboxTaskProps = {
  taskId: string;
};

const VISIBLE_ACTIVITIES = 6;

// The task a notification points at, with enough of its thread to answer
// without leaving the inbox.
export function InboxTask({ taskId }: InboxTaskProps) {
  const { t } = useTranslation();
  const { data: task, isLoading } = useGetTask(taskId, true);
  const {
    data: activities,
    isPending: activityPending,
    isError: activityError,
  } = useGetActivitiesByTaskId(taskId, true, VISIBLE_ACTIVITIES);
  const { data: columns = [] } = useGetColumns(task?.projectId ?? "");
  const statusColumn = columns.find(
    (column) => column.slug === task?.status || column.id === task?.status,
  );
  const { canUpdateTasks } = useWorkspacePermission();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <p role="alert" className="text-muted-foreground text-sm">
        {t("notifications:inbox.taskUnavailable")}
      </p>
    );
  }

  const recent = (activities ?? []).slice(0, VISIBLE_ACTIVITIES);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3.5">
        <h2 className="font-semibold text-2xl text-foreground tracking-tight">
          {task.title}
        </h2>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-foreground/85">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{t("tasks:status.label")}</dt>
            <dd className="flex items-center gap-1.5">
              {getColumnIcon(
                task.status,
                statusColumn?.isFinal,
                statusColumn?.icon,
              )}
              {getStatusDisplayLabel(task.status, statusColumn?.name)}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{t("tasks:priority.label")}</dt>
            <dd className="flex items-center gap-1.5 [&_svg]:size-3.5">
              {getPriorityIcon(task.priority ?? "")}
              {getPriorityLabel(task.priority ?? "no-priority")}
            </dd>
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t("tasks:dueDate.label")}</dt>
              <dd>
                <DueDateText dueDate={task.dueDate} className="text-[13px]" />
              </dd>
            </div>
          )}
          {task.assigneeName && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t("tasks:assignee.label")}</dt>
              <dd>{task.assigneeName}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex flex-col gap-3 border-border/60 border-t pt-5">
        <h3 className="font-medium text-muted-foreground text-xs">
          {t("notifications:inbox.recentActivity")}
        </h3>
        {activityPending ? (
          <Skeleton
            aria-label={t("common:empty.loading")}
            className="h-24 w-full"
          />
        ) : activityError && !activities ? (
          <p role="alert" className="text-muted-foreground text-sm">
            {t("workspace:home.activity.loadError")}
          </p>
        ) : (
          recent.length > 0 && (
            <Timeline>
              {recent.map((activity, index) => {
                const next = recent[index + 1];
                return (
                  <Activity
                    key={activity.id}
                    activity={activity}
                    step={recent.length - index}
                    showConnector={
                      !isCommentActivity(activity) &&
                      Boolean(next) &&
                      !isCommentActivity(next)
                    }
                  />
                );
              })}
            </Timeline>
          )
        )}
        {canUpdateTasks() && <CommentInput taskId={taskId} />}
      </div>
    </div>
  );
}
