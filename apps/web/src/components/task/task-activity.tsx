import { useTranslation } from "react-i18next";
import Activity from "@/components/activity";
import CommentInput from "@/components/activity/comment-input";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Timeline } from "@/components/ui/timeline";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import { cn } from "@/lib/cn";

type TaskActivityProps = {
  taskId: string;
  projectId: string;
  className?: string;
};

export function TaskActivity({
  taskId,
  projectId,
  className,
}: TaskActivityProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: newestFirst = [] } = useGetActivitiesByTaskId(taskId);
  const activities = [...newestFirst].reverse();

  return (
    <section
      aria-label={t("tasks:detail.activity")}
      className={cn("flex flex-col gap-1", className)}
    >
      <h2 className="flex h-7 items-center pb-1 font-medium text-[13px] text-foreground">
        {t("tasks:detail.activity")}
      </h2>

      {activities.length > 0 ? (
        <Timeline>
          {activities.map((activity, index) => (
            <Activity key={activity.id} activity={activity} step={index + 1} />
          ))}
        </Timeline>
      ) : (
        <p className="px-2 py-1 text-muted-foreground text-xs">
          {t("tasks:detail.noActivity")}
        </p>
      )}

      {user?.id && (
        <div className="pt-2">
          <CommentInput taskId={taskId} projectId={projectId} />
        </div>
      )}
    </section>
  );
}
