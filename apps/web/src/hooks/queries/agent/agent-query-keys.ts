export const agentQueryKeys = {
  codeStatus: (workspaceId: string) =>
    ["agent", workspaceId, "code-status"] as const,
  codeRepositories: (workspaceId: string) =>
    ["agent", workspaceId, "code-repositories"] as const,
  codeJob: (workspaceId: string, jobId: string) =>
    ["agent", workspaceId, "code-job", jobId] as const,
  codeJobEvents: (workspaceId: string, jobId: string, after: number) =>
    ["agent", workspaceId, "code-job-events", jobId, after] as const,
  all: (workspaceId: string) => ["agent", workspaceId] as const,
  config: (workspaceId: string) => ["agent", workspaceId, "config"] as const,
  conversations: (workspaceId: string, projectId?: string) =>
    ["agent", workspaceId, "conversations", projectId ?? "all"] as const,
  conversation: (workspaceId: string, conversationId: string) =>
    ["agent", workspaceId, "conversation", conversationId] as const,
  conversationRuns: (workspaceId: string, conversationId: string) =>
    ["agent", workspaceId, "conversation-runs", conversationId] as const,
  recentRuns: (workspaceId: string) =>
    ["agent", workspaceId, "recent-runs"] as const,
  run: (workspaceId: string, runId: string) =>
    ["agent", workspaceId, "run", runId] as const,
};
