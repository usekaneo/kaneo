import type { AutomationListQuery } from "@/types/agent-automation";

export const automationQueryKeys = {
  all: (workspaceId: string) => ["agent-automations", workspaceId] as const,
  lists: (workspaceId: string) =>
    ["agent-automations", workspaceId, "list"] as const,
  list: (workspaceId: string, query: AutomationListQuery = {}) =>
    ["agent-automations", workspaceId, "list", query] as const,
  detail: (workspaceId: string, id: string) =>
    ["agent-automations", workspaceId, "detail", id] as const,
  runs: (
    workspaceId: string,
    id: string,
    query: { limit?: string; offset?: string } = {},
  ) => ["agent-automations", workspaceId, "runs", id, query] as const,
};
