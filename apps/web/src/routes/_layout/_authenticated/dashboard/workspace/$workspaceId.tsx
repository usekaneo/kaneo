import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import getProjects from "@/fetchers/project/get-projects";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  beforeLoad: async ({ params, location, context }) => {
    const currentPath = location.pathname.replace(/\/+$/, "");
    const workspacePath = `/dashboard/workspace/${params.workspaceId}`;

    if (currentPath !== workspacePath) return;

    let projects: Awaited<ReturnType<typeof getProjects>> | undefined;
    try {
      projects = await context.queryClient.fetchQuery({
        queryKey: ["projects", params.workspaceId],
        queryFn: () => getProjects({ workspaceId: params.workspaceId }),
      });
    } catch {
      return;
    }

    if (projects?.length !== 1) return;

    throw redirect({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        workspaceId: params.workspaceId,
        projectId: projects[0].id,
      },
      replace: true,
    });
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
