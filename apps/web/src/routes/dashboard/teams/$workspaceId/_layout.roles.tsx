import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
export const Route = createFileRoute(
  "/dashboard/teams/$workspaceId/_layout/roles",
)({
  component: RouteComponent,
});
const { t } = useTranslation();
function RouteComponent() {
  return (
    <div>
      {t("hello_dashboard_workspace_workspaceid_team_roles", {
        defaultValue: 'Hello "/dashboard/workspace/$workspaceId/team/roles"!',
      })}
    </div>
  );
}
