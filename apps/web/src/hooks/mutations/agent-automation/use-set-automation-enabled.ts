import { useMutation, useQueryClient } from "@tanstack/react-query";
import setAutomationEnabled from "@/fetchers/agent-automation/set-automation-enabled";
import { automationQueryKeys } from "@/hooks/queries/agent-automation/automation-query-keys";
import type { Automation, AutomationList } from "@/types/agent-automation";

export default function useSetAutomationEnabled(
  workspaceId: string,
  automationId: string,
) {
  const queryClient = useQueryClient();
  const detailKey = automationQueryKeys.detail(workspaceId, automationId);
  const listKey = automationQueryKeys.lists(workspaceId);
  return useMutation({
    mutationKey: ["set-automation-enabled", workspaceId, automationId],
    // Serialize quick successive toggles so responses cannot arrive in reverse.
    scope: { id: `automation-enabled:${workspaceId}:${automationId}` },
    mutationFn: (enabled: boolean) =>
      setAutomationEnabled(workspaceId, automationId, enabled),
    onMutate: async (enabled) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ]);
      const detail = queryClient.getQueryData<Automation>(detailKey);
      const lists = queryClient.getQueriesData<AutomationList>({
        queryKey: listKey,
      });
      const patch = {
        enabled,
        pausedReason: null,
        consecutiveFailures: 0,
        lastSkipReason: null,
      } as const;
      queryClient.setQueryData<Automation>(detailKey, (current) =>
        current ? { ...current, ...patch } : current,
      );
      queryClient.setQueriesData<AutomationList>(
        { queryKey: listKey },
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.kind === "agent" && item.id === automationId
                    ? { ...item, ...patch }
                    : item,
                ),
              }
            : current,
      );
      return { detail, lists };
    },
    onError: (_error, _enabled, context) => {
      // Restore only this automation; unrelated concurrent edits stay intact.
      if (context?.detail) queryClient.setQueryData(detailKey, context.detail);
      for (const [key, before] of context?.lists ?? [])
        queryClient.setQueryData<AutomationList>(key, (current) => {
          const previous = before?.items.find(
            (item) => item.id === automationId && item.kind === "agent",
          );
          return current && previous
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.kind === "agent" && item.id === automationId
                    ? previous
                    : item,
                ),
              }
            : current;
        });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: automationQueryKeys.all(workspaceId),
      });
    },
  });
}
