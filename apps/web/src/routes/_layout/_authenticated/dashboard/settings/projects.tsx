import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/components/settings/settings-page";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id ?? "",
  });
  const isProjectsRoot =
    location.pathname.replace(/\/+$/, "") === "/dashboard/settings/projects";

  useEffect(() => {
    if (!isProjectsRoot || !projects?.length) return;

    void navigate({
      to: "/dashboard/settings/projects/$projectId/general",
      params: { projectId: projects[0].id },
      replace: true,
    });
  }, [isProjectsRoot, navigate, projects]);

  if (isProjectsRoot && projects?.length === 0) {
    return (
      <SettingsPage
        title={t("navigation:sidebar.projects")}
        description={t("settings:projectSwitcher.noProjects")}
      />
    );
  }

  return <Outlet />;
}
