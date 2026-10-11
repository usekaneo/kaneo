import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useToast } from "../components/toast";
import { userMessage } from "./api/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Query keys, grouped so a whole area can be invalidated at once. */
export const qk = {
  workspaces: ["workspaces"] as const,
  me: ["me"] as const,
  invitations: ["invitations"] as const,
  projects: (workspaceId: string, archived = false) =>
    ["projects", workspaceId, archived] as const,
  project: (id: string) => ["project", id] as const,
  board: (projectId: string) => ["board", projectId] as const,
  assigned: (workspaceId: string) => ["assigned", workspaceId] as const,
  notifications: (workspaceId: string) =>
    ["notifications", workspaceId] as const,
  activity: (workspaceId: string) => ["activity", workspaceId] as const,
  members: (workspaceId: string, projectId?: string) =>
    ["members", workspaceId, projectId ?? null] as const,
  labels: (workspaceId: string) => ["labels", workspaceId] as const,
  task: (id: string) => ["task", id] as const,
  taskExtras: (id: string) => ["taskExtras", id] as const,
  columns: (projectId: string) => ["columns", projectId] as const,
  customFields: (projectId: string) => ["customFields", projectId] as const,
  fullWorkspace: (id: string) => ["fullWorkspace", id] as const,
  roles: (id: string) => ["roles", id] as const,
  notificationPrefs: ["notificationPrefs"] as const,
  search: (workspaceId: string, q: string, type: string) =>
    ["search", workspaceId, q, type] as const,
};

/**
 * Runs a mutation, reports failures (and an optional success note) as a toast, then refreshes
 * every open query. Cheaper than tracking which query each change touches, and lists stay
 * visible while they reload.
 */
export function useAction() {
  const client = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T>(
      block: () => Promise<T>,
      options: { success?: string; refresh?: boolean } = {},
    ): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await block();
        if (options.success) toast.show(options.success, "success");
        if (options.refresh !== false) void client.invalidateQueries();
        return result;
      } catch (e) {
        toast.show(userMessage(e), "error");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [client, toast],
  );

  return { run, busy };
}
