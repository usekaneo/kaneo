export const agentQueryKeys = {
  all: (workspaceId: string) => ["agent", workspaceId] as const,
  config: (workspaceId: string) => ["agent", workspaceId, "config"] as const,
  conversations: (workspaceId: string, projectId?: string) =>
    ["agent", workspaceId, "conversations", projectId ?? "all"] as const,
  conversationRuns: (workspaceId: string, conversationId: string) =>
    ["agent", workspaceId, "conversation-runs", conversationId] as const,
  recentRuns: (workspaceId: string) =>
    ["agent", workspaceId, "recent-runs"] as const,
  run: (workspaceId: string, runId: string) =>
    ["agent", workspaceId, "run", runId] as const,
};
