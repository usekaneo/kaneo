import { createFileRoute } from "@tanstack/react-router";
import TaskLayout from "@/components/common/task-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsContent from "@/components/task/task-details-content";
import TaskPropertiesSidebar from "@/components/task/task-properties-sidebar";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, workspaceId, taskId } = Route.useParams();
  const { data: task } = useGetTask(taskId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });

  return (
    <TaskLayout
      taskId={taskId}
      projectId={projectId}
      workspaceId={workspaceId}
      rightSidebar={
        <TaskPropertiesSidebar
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          className="w-full lg:w-56 xl:w-64 h-full bg-sidebar border-b lg:border-b-0 lg:border-l border-border flex flex-col gap-2"
        />
      }
    >
      <PageTitle
        title={`${project?.slug}-${task?.number} — ${task?.title}`}
        hideAppName
      />
      <TaskDetailsContent
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        className="flex flex-col h-full min-h-0 max-w-3xl mx-auto px-3 sm:px-4 xl:py-8 py-2 gap-2"
      />
    </TaskLayout>
  );
}
