import { createFileRoute, redirect } from "@tanstack/react-router";

type GanttSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt",
)({
  validateSearch: (search: Record<string, unknown>): GanttSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId",
      params: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        pluginId: "gantt",
        viewId: "timeline",
      },
      search: search.taskId ? { taskId: search.taskId } : {},
      replace: true,
    });
  },
});
