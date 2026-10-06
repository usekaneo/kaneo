import type { QueryClient } from "@tanstack/react-query";

export function evictWorkspaceCache(client: QueryClient, workspaceId: string) {
  evictPrivateQueries(client, workspaceId);
}

export function evictInaccessibleWorkspaceCache(
  client: QueryClient,
  workspaceIds: string[],
) {
  evictPrivateQueries(client, undefined, new Set(workspaceIds));
}

function evictPrivateQueries(
  client: QueryClient,
  workspaceId?: string,
  allowed?: Set<string>,
) {
  const queries = client.getQueryCache().getAll();
  const ids = new Set<string>(workspaceId ? [workspaceId] : []);
  const scopes = new Map<string, string>(
    Array.from(allowed ?? [], (id) => [id, id]),
  );
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
      if (
        typeof record.workspaceId === "string" &&
        (allowed
          ? !allowed.has(record.workspaceId)
          : record.workspaceId === workspaceId) &&
        typeof record.id === "string"
      )
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
        (allowed &&
          typeof record.workspaceId === "string" &&
          !allowed.has(record.workspaceId)) ||
        Object.values(record).some(
          (value) => typeof value === "string" && ids.has(value),
        )
      )
        affected = true;
    });
    let knownOtherWorkspace = query.queryKey.some(
      (value) =>
        typeof value === "string" &&
        scopes.has(value) &&
        (allowed
          ? allowed.has(scopes.get(value)!)
          : scopes.get(value) !== workspaceId),
    );
    visit(query.queryKey, (record) => {
      if (
        typeof record.workspaceId === "string" &&
        (allowed
          ? allowed.has(record.workspaceId)
          : record.workspaceId !== workspaceId)
      )
        knownOtherWorkspace = true;
      if (
        Object.values(record).some(
          (value) =>
            typeof value === "string" &&
            scopes.has(value) &&
            (allowed
              ? allowed.has(scopes.get(value)!)
              : scopes.get(value) !== workspaceId),
        )
      )
        knownOtherWorkspace = true;
    });
    const privatePrefixes = new Set([
      "github-repositories",
      "gitea-repositories",
      "gitlab-projects",
      "active-organization",
      "github-integration",
      "gitlab-integration",
      "gitea-integration",
      "slack-integration",
      "discord-integration",
      "mattermost-integration",
      "telegram-integration",
      "generic-webhook-integration",
      "calendar-feeds",
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
  // Keep active observers attached: removing their query can strand a board
  // opened concurrently with the access snapshot. Reset and refetch instead.
  client.removeQueries({
    predicate: (query) => predicate(query) && !query.isActive(),
  });
  void client.resetQueries({
    predicate: (query) => predicate(query) && query.isActive(),
  });
}
