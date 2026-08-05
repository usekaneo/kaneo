import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import CalendarView from "@/components/calendar/calendar-view";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";

type CalendarSearchParams = { taskId?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/calendar",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project } = useGetTasks(projectId);
  const tasks = [
    ...(project?.columns.flatMap((column) => column.tasks) ?? []),
    ...(project?.plannedTasks ?? []),
  ];

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="calendar"
    >
      <PageTitle
        title={t("tasks:calendar.pageTitle", { name: project?.name })}
        hideAppName
      />
      <CalendarView
        tasks={tasks}
        onOpenTask={(id) =>
          navigate({ to: ".", search: { taskId: id }, replace: true })
        }
      />
      <TaskDetailsSheet
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={() =>
          navigate({
            to: ".",
            search: {},
            replace: true,
          })
        }
      />
    </ProjectLayout>
  );
}
