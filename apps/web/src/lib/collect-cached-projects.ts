import type { QueryClient } from "@tanstack/react-query";

export function collectCachedProjects(
  client: QueryClient,
  workspaceId: string,
): { id: string }[] {
  const ids = new Set<string>();
  for (const query of client
    .getQueryCache()
    .findAll({ queryKey: ["projects", workspaceId] })) {
    const data = query.state.data;
    const scope = query.queryKey[2];
    if (Array.isArray(data)) {
      for (const project of data)
        if (typeof project?.id === "string") ids.add(project.id);
    } else if (typeof scope === "string" && scope !== "including-archived") {
      ids.add(scope);
    }
  }
  return [...ids].map((id) => ({ id }));
}
