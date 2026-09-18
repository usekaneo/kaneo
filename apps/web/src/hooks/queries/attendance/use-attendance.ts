import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getAttendanceDays,
  getAttendanceStatus,
  getTeamAttendance,
} from "@/fetchers/attendance";

export function useAttendanceStatus(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["attendance", "status", workspaceId],
    queryFn: () => getAttendanceStatus(workspaceId as string),
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
  });
}

export function useAttendanceDays(query: {
  workspaceId: string | undefined;
  userId?: string;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: ["attendance", "days", query],
    queryFn: () =>
      getAttendanceDays({ ...query, workspaceId: query.workspaceId as string }),
    enabled: !!query.workspaceId,
    placeholderData: keepPreviousData,
  });
}

export function useTeamAttendance(
  workspaceId: string | undefined,
  day: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["attendance", "team", workspaceId, day],
    queryFn: () => getTeamAttendance(workspaceId as string, day),
    enabled: !!workspaceId && enabled,
    placeholderData: keepPreviousData,
  });
}
