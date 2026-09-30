import type { QueryClient } from "@tanstack/react-query";

export function evictWorkspaceCache(client: QueryClient, workspaceId: string) {
  const queries = client.getQueryCache().getAll();
  const ids = new Set([workspaceId]);
  const scopes = new Map<string, string>();
  const visit = (
    value: unknown,
    callback: (record: Record<string, unknown>) => void,
  ) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, callback);
      return;
    }
    const record = value as Record<string, unknown>;
    callback(record);
    for (const item of Object.values(record)) visit(item, callback);
  };
  for (const query of queries)
    visit(query.state.data, (record) => {
      if (typeof record.workspaceId === "string")
        scopes.set(record.workspaceId, record.workspaceId);
      if (
        typeof record.workspaceId === "string" &&
        typeof record.id === "string"
      )
        scopes.set(record.id, record.workspaceId);
      if (record.workspaceId === workspaceId && typeof record.id === "string")
        ids.add(record.id);
    });
  for (const query of queries)
    visit(query.state.data, (record) => {
      if (
        typeof record.projectId === "string" &&
        typeof record.id === "string" &&
        scopes.has(record.projectId)
      )
        scopes.set(record.id, scopes.get(record.projectId)!);
      if (
        typeof record.projectId === "string" &&
        ids.has(record.projectId) &&
        typeof record.id === "string"
      )
        ids.add(record.id);
    });
  const predicate = (query: (typeof queries)[number]) => {
    if (query.queryKey[0] === "notifications") return true;
    let affected = false;
    visit([query.queryKey, query.state.data], (record) => {
      if (
        Object.values(record).some(
          (value) => typeof value === "string" && ids.has(value),
        )
      )
        affected = true;
    });
    const knownOtherWorkspace = query.queryKey.some(
      (value) =>
        typeof value === "string" &&
        scopes.has(value) &&
        scopes.get(value) !== workspaceId,
    );
    const privatePrefixes = new Set([
      "github-integration",
      "gitlab-integration",
      "gitea-integration",
      "slack-integration",
      "discord-integration",
      "mattermost-integration",
      "telegram-integration",
      "generic-webhook-integration",
      "columns",
      "workflow-rules",
      "custom-fields",
      "custom-field-values",
      "custom-field-filter-values",
      "time-entries",
      "billing",
      "workspace-users",
      "workspace-user",
      "active-workspace-users",
      "workspace-roles",
      "workspace-capabilities",
      "workspace-invites",
      "task",
      "tasks",
      "task-relations",
      "activities",
      "comments",
      "labels",
      "external-links",
      "projects",
      "project",
      "workspace",
      "workspaces",
      "members",
      "roles",
      "search",
    ]);
    return (
      (privatePrefixes.has(String(query.queryKey[0])) &&
        !knownOtherWorkspace) ||
      affected ||
      query.queryKey.some(
        (value) => typeof value === "string" && ids.has(value),
      )
    );
  };
  void client.cancelQueries({ predicate });
  client.removeQueries({ predicate });
}
