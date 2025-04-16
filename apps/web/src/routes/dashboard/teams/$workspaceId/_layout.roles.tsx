import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute(
  "/dashboard/teams/$workspaceId/_layout/roles",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return <div>{t("team.roles.title", { defaultValue: "Team Roles" })}</div>;
}
