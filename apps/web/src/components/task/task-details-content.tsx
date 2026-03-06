import Activity from "@/components/activity";
import CommentInput from "@/components/activity/comment-input";
import { isCommentActivity } from "@/components/activity/utils";
import { ExternalLinksAccordion } from "@/components/external-links/external-links-accordion";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Timeline } from "@/components/ui/timeline";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import type { ExternalLink } from "@/types/external-link";
import TaskDescription from "./task-description";
import TaskTitle from "./task-title";

type TaskDetailsContentProps = {
  taskId: string | undefined;
  projectId: string;
  workspaceId: string;
  className?: string;
};

export default function TaskDetailsContent({
  taskId,
  projectId,
  workspaceId,
  className,
}: TaskDetailsContentProps) {
  const { data: task } = useGetTask(taskId ?? "");
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: activities = [] } = useGetActivitiesByTaskId(taskId ?? "");
  const { data: externalLinks = [], isLoading: isLoadingExternalLinks } =
    useExternalLinks(taskId ?? "");
  const { user } = useAuth();

  if (!taskId) return null;

  return (
    <div className={`${className} gap-4`}>
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-foreground/70">
          {project?.slug}-{task?.number}
        </p>
        <TaskTitle taskId={taskId} />
        <TaskDescription taskId={taskId} />
      </div>
      {!isLoadingExternalLinks && externalLinks.length > 0 && (
        <div className="mt-4">
          <ExternalLinksAccordion
            externalLinks={externalLinks as ExternalLink[]}
            isLoading={isLoadingExternalLinks}
          />
        </div>
      )}
      <span className="text-sm font-medium text-muted-foreground h-[1px] bg-border w-full block shrink-0" />
      <div className="flex flex-col gap-4">
        <h1 className="text-md font-semibold">Activity</h1>
        {user?.id && taskId && <CommentInput taskId={taskId} />}
        {activities.length > 0 ? (
          <Timeline>
            {activities.map((activity, index) => {
              const nextActivity = activities[index + 1];
              const showConnector =
                !isCommentActivity(activity) &&
                Boolean(nextActivity) &&
                !isCommentActivity(nextActivity);

              return (
                <Activity
                  key={activity.id}
                  activity={activity}
                  step={activities.length - index}
                  showConnector={showConnector}
                />
              );
            })}
          </Timeline>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            No activity found
          </p>
        )}
      </div>
    </div>
  );
}
