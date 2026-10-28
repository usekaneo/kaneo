import { keepPreviousData, useQuery } from "@tanstack/react-query";
import globalSearch from "@/fetchers/search/global-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  AGENT_MENTION_OPTION_LIMIT,
  toAgentMentionOptions,
} from "./to-agent-mention-options";

export type AgentMentionScope = { workspaceId: string; projectId?: string };

function useSearch(params: Parameters<typeof globalSearch>[0]) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => globalSearch(params),
    enabled: params.q.length > 0,
    staleTime: 30_000,
    // Keeps the menu steady between keystrokes.
    placeholderData: keepPreviousData,
  });
}

// A board panel conversation only reaches its own project, so it searches
// that project's tasks; elsewhere tasks and projects across the workspace.
export function useAgentMentionSearch(
  { workspaceId, projectId }: AgentMentionScope,
  query: string | null,
) {
  const q = useDebouncedValue(query?.trim() ?? "", 120);
  const tasks = useSearch({
    q,
    type: "tasks",
    workspaceId,
    projectId,
    limit: AGENT_MENTION_OPTION_LIMIT,
  });
  const projects = useSearch({
    q: projectId ? "" : q,
    type: "projects",
    workspaceId,
    limit: 4,
  });
  if (!query?.trim()) return [];
  return toAgentMentionOptions(
    tasks.data?.results,
    projectId ? [] : projects.data?.results,
  );
}
