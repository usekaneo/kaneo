import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { type ReportQuery, reportsApi } from "@/fetchers/reports";

export function useReportSummary(query: ReportQuery | null) {
  return useQuery({
    queryKey: ["reports", "summary", query],
    queryFn: () => reportsApi.summary(query as ReportQuery),
    enabled: !!query,
    placeholderData: keepPreviousData,
  });
}

export function useReportActivity(query: ReportQuery | null) {
  return useInfiniteQuery({
    queryKey: ["reports", "activity", query],
    queryFn: ({ pageParam }) =>
      reportsApi.activity({
        ...(query as ReportQuery),
        ...(pageParam ? { before: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.nextBefore ? new Date(last.nextBefore).toISOString() : undefined,
    enabled: !!query,
  });
}
