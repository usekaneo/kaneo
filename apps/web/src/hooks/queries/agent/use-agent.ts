import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getActivitySpans,
  getActivitySummary,
  listDevices,
} from "@/fetchers/agent";

export function useDevices(workspaceId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ["agent-devices", workspaceId, userId ?? "me"],
    queryFn: () => listDevices(workspaceId as string, userId),
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  });
}

export function useActivitySummary(query: {
  workspaceId: string | undefined;
  userId?: string;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: ["activity", "summary", query],
    queryFn: () =>
      getActivitySummary({
        ...query,
        workspaceId: query.workspaceId as string,
      }),
    enabled: !!query.workspaceId,
    placeholderData: keepPreviousData,
  });
}

export function useActivitySpans(
  query: { workspaceId: string | undefined; userId?: string; day: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["activity", "spans", query],
    queryFn: () =>
      getActivitySpans({ ...query, workspaceId: query.workspaceId as string }),
    enabled: enabled && !!query.workspaceId,
  });
}
