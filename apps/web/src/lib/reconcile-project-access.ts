import type { QueryClient } from "@tanstack/react-query";
import getProjects from "@/fetchers/project/get-projects";
import { collectCachedProjects } from "./collect-cached-projects";
import { evictProjectCache } from "./evict-project-cache";
import { findRemovedProjectIds } from "./find-removed-project-ids";

export function reconcileProjectAccess(
  client: QueryClient,
  workspaceId: string,
  isActive: () => boolean,
) {
  const before = collectCachedProjects(client, workspaceId);
  if (before.length === 0) return;
  void client
    .fetchQuery({
      queryKey: ["projects", workspaceId, "including-archived"],
      queryFn: () => getProjects({ workspaceId, includeArchived: "true" }),
    })
    .then((after) => {
      if (!isActive()) return;
      const removed = findRemovedProjectIds(before, after);
      for (const projectId of removed) evictProjectCache(client, projectId);
      if (removed.length > 0) {
        void client.invalidateQueries({ queryKey: ["projects", workspaceId] });
        void client.invalidateQueries({ queryKey: ["notifications"] });
      }
    })
    .catch(() => {});
}
