import { useQuery } from "@tanstack/react-query";

import { api } from "./api/endpoints";
import type { Label, Workspace } from "./api/types";
import { qk } from "./query";
import { sessionStore, usePrefs, useSession } from "./session";

export function useWorkspaces() {
  return useQuery({ queryKey: qk.workspaces, queryFn: api.workspaces });
}

/** The remembered workspace if it still exists, otherwise the first one. */
export function useCurrentWorkspace(): {
  workspace: Workspace | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
} {
  const prefs = usePrefs();
  const query = useWorkspaces();
  const list = query.data ?? [];
  const workspace =
    list.find((w) => w.id === prefs.lastWorkspaceId) ?? list[0] ?? null;
  return {
    workspace,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

export async function selectWorkspace(workspace: Workspace) {
  await sessionStore.updatePrefs({ lastWorkspaceId: workspace.id });
  // Keeps the server-side active workspace in step with the web app.
  api.setActiveWorkspace(workspace.id).catch(() => {});
}

export function useMembers(workspaceId?: string | null, projectId?: string) {
  return useQuery({
    queryKey: qk.members(workspaceId ?? "", projectId),
    queryFn: () => api.workspaceMembers(workspaceId!, projectId),
    enabled: !!workspaceId,
  });
}

/** Workspace labels, without per-task copies or ones being deleted, unique by name. */
export function useWorkspaceLabels(workspaceId?: string | null) {
  return useQuery({
    queryKey: qk.labels(workspaceId ?? ""),
    queryFn: async () => {
      const list = await api.workspaceLabels(workspaceId!);
      const seen = new Set<string>();
      return list
        .filter((l) => !l.taskId && !l.deletionStartedAt)
        .filter((l) => (seen.has(l.name) ? false : (seen.add(l.name), true)))
        .sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        ) as Label[];
    },
    enabled: !!workspaceId,
  });
}

export function useMe() {
  const session = useSession();
  return useQuery({ queryKey: qk.me, queryFn: api.me, enabled: !!session });
}

export function useUnreadCount(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: qk.notifications(workspaceId ?? ""),
    queryFn: () => api.notifications(workspaceId!),
    enabled: !!workspaceId,
  });
  return (query.data ?? []).filter((n) => n.isRead !== true).length;
}
