import type { QueryClient } from "@tanstack/react-query";

const versions = new WeakMap<QueryClient, Map<string, number>>();
export function markBoardCacheChanged(
  client: QueryClient,
  projectId: string,
  taskId?: string,
) {
  const cache = versions.get(client) ?? new Map<string, number>();
  versions.set(client, cache);
  const key = taskId ? `${projectId}:${taskId}` : projectId;
  cache.set(key, (cache.get(key) ?? 0) + 1);
}
export function getBoardCacheVersion(
  client: QueryClient,
  projectId: string,
  taskId: string,
) {
  const cache = versions.get(client);
  return `${cache?.get(projectId) ?? 0}:${cache?.get(`${projectId}:${taskId}`) ?? 0}`;
}
