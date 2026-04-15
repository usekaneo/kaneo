import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Activity from "@/components/activity";
import type { MentionableMember } from "@/components/activity/comment-editor";
import CommentInput from "@/components/activity/comment-input";
import { isCommentActivity } from "@/components/activity/utils";
import { ExternalLinksAccordion } from "@/components/external-links/external-links-accordion";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Timeline } from "@/components/ui/timeline";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import type { ExternalLink } from "@/types/external-link";
import TaskDescription from "./task-description";
import TaskRelations from "./task-relations";
import TaskSubtasks from "./task-subtasks";
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: task } = useGetTask(taskId ?? "");
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: activities = [] } = useGetActivitiesByTaskId(taskId ?? "");
  const { data: externalLinks = [], isLoading: isLoadingExternalLinks } =
    useExternalLinks(taskId ?? "");
  const { data: relations = [] } = useGetTaskRelations(taskId ?? "");
  const { data: workspaceUsers } = useGetWorkspaceUsers({
    workspaceId,
  });
  const { user } = useAuth();
  const mentionableMembers = useMemo<MentionableMember[]>(
    () =>
      (workspaceUsers ?? []).flatMap((member) => {
        const userId = member.user?.id;
        const name = member.user?.name?.trim() || member.user?.email?.trim();

        if (!userId || !name) {
          return [];
        }

        return [
          {
            id: userId,
            name,
            email: member.user?.email ?? null,
            image: member.user?.image ?? null,
          },
        ];
      }),
    [workspaceUsers],
  );

  const parentRelation = relations.find(
    (rel) => rel.relationType === "subtask" && rel.targetTaskId === taskId,
  );
  const parentTask = parentRelation?.sourceTask;

  if (!taskId) return null;

  return (
    <div className={`${className} gap-4`}>
      <div className="flex flex-col gap-2.5">
        {parentTask && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            onClick={() =>
              navigate({
                to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                params: {
                  workspaceId,
                  projectId,
                  taskId: parentTask.id,
                },
              })
            }
          >
            <ArrowUpRight className="size-3" />
            <span>
              {t("tasks:detail.subtaskOf")}{" "}
              <span className="font-medium">{parentTask.title}</span>
            </span>
          </button>
        )}
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
      <div className="mt-4">
        <TaskSubtasks
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
        />
      </div>
      <div className="mt-2">
        <TaskRelations
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
        />
      </div>
      <span className="text-sm font-medium text-muted-foreground h-[1px] bg-border w-full block shrink-0" />
      <div className="flex flex-col gap-4">
        <h1 className="text-md font-semibold">{t("tasks:detail.activity")}</h1>
        {user?.id && taskId && (
          <CommentInput
            taskId={taskId}
            mentionableMembers={mentionableMembers}
          />
        )}
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
                  workspaceUsers={workspaceUsers}
                  mentionableMembers={mentionableMembers}
                />
              );
            })}
          </Timeline>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            {t("tasks:detail.noActivity")}
          </p>
        )}
      </div>
    </div>
  );
}
