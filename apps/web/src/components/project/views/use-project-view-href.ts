import { useRouter } from "@tanstack/react-router";
import {
  PROJECT_ROUTE_PATHS,
  type ProjectView,
  routeForView,
} from "./project-views";

export function useProjectViewHref(
  view: ProjectView,
  workspaceId: string,
  projectId: string,
) {
  const router = useRouter();
  return router.buildLocation({
    to: PROJECT_ROUTE_PATHS[routeForView(view)],
    params: { workspaceId, projectId },
  }).href;
}
