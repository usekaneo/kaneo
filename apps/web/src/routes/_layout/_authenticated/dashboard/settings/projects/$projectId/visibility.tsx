import { createFileRoute } from "@tanstack/react-router";
import { ProjectVisibilityPage } from "@/components/settings/project-visibility/project-visibility-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/visibility",
)({
  component: ProjectVisibilityPage,
});
