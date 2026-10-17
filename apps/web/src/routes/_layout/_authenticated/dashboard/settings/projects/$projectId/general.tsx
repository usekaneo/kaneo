import { createFileRoute } from "@tanstack/react-router";
import { ProjectGeneralPage } from "@/components/settings/project-general/project-general-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/general",
)({
  component: ProjectGeneralPage,
});
