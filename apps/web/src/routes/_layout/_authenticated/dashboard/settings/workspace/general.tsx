import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceGeneralPage } from "@/components/settings/workspace-general/workspace-general-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/general",
)({
  component: WorkspaceGeneralPage,
});
