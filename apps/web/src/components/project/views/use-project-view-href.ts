import { useRouter } from "@tanstack/react-router";
import { type ProjectView, routeForView } from "./project-views";
import { viewLocation } from "./view-location";

export function useProjectViewHref(
  view: ProjectView,
  workspaceId: string,
  projectId: string,
) {
  const router = useRouter();
  return router.buildLocation(
    viewLocation(routeForView(view), workspaceId, projectId),
  ).href;
}
