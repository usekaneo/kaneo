import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { overviewApi } from "@/fetchers/overview";
import { payApi } from "@/fetchers/pay";
import { type LeaveHistoryFilters, requestsApi } from "@/fetchers/requests";

// Query hooks for pay, requests and overview. Keys start with the area so a
// mutation can refresh everything it touches with one prefix.

export const usePayslips = (workspaceId?: string, userId?: string) =>
  useQuery({
    queryKey: ["pay", "payslips", workspaceId, userId ?? "me"],
    queryFn: () => payApi.payslips(workspaceId as string, userId),
    enabled: !!workspaceId,
  });

export const useSalaryHistory = (workspaceId?: string, userId?: string) =>
  useQuery({
    queryKey: ["pay", "salaries", workspaceId, userId ?? "me"],
    queryFn: () => payApi.salaries(workspaceId as string, userId),
    enabled: !!workspaceId,
  });

export const useCurrentSalaries = (workspaceId?: string, enabled = true) =>
  useQuery({
    queryKey: ["pay", "current", workspaceId],
    queryFn: () => payApi.currentSalaries(workspaceId as string),
    enabled: !!workspaceId && enabled,
  });

export const usePayrollRuns = (workspaceId?: string, enabled = true) =>
  useQuery({
    queryKey: ["pay", "runs", workspaceId],
    queryFn: () => payApi.runs(workspaceId as string),
    enabled: !!workspaceId && enabled,
  });

export const usePayrollRun = (workspaceId?: string, id?: string) =>
  useQuery({
    queryKey: ["pay", "run", workspaceId, id],
    queryFn: () => payApi.run(workspaceId as string, id as string),
    enabled: !!workspaceId && !!id,
  });

export const useLeaveRequests = (workspaceId?: string, userId?: string) =>
  useQuery({
    queryKey: ["requests", "leave", workspaceId, userId ?? "me"],
    queryFn: () => requestsApi.leave(workspaceId as string, userId),
    enabled: !!workspaceId,
  });

export const useLeaveBalance = (workspaceId?: string, userId?: string) =>
  useQuery({
    queryKey: ["requests", "balance", workspaceId, userId ?? "me"],
    queryFn: () => requestsApi.balance(workspaceId as string, userId),
    enabled: !!workspaceId,
  });

export const useAllLeave = (
  workspaceId: string | undefined,
  filters: LeaveHistoryFilters,
  enabled = true,
) =>
  useQuery({
    queryKey: ["requests", "all-leave", workspaceId, filters],
    queryFn: () => requestsApi.allLeave(workspaceId as string, filters),
    enabled: !!workspaceId && enabled,
    placeholderData: keepPreviousData,
  });

export const useLeavePreview = (
  workspaceId: string | undefined,
  startDate: string,
  endDate: string,
) =>
  useQuery({
    queryKey: ["requests", "preview", workspaceId, startDate, endDate],
    queryFn: () =>
      requestsApi.previewLeave(workspaceId as string, startDate, endDate),
    enabled: !!workspaceId && !!startDate && !!endDate && endDate >= startDate,
    retry: false,
  });

export const useExpenses = (workspaceId?: string, userId?: string) =>
  useQuery({
    queryKey: ["requests", "expenses", workspaceId, userId ?? "me"],
    queryFn: () => requestsApi.expenses(workspaceId as string, userId),
    enabled: !!workspaceId,
  });

export const useOpenRequests = (workspaceId?: string, enabled = true) =>
  useQuery({
    queryKey: ["requests", "open", workspaceId],
    queryFn: () => requestsApi.open(workspaceId as string),
    enabled: !!workspaceId && enabled,
  });

export const useCompanyToday = (workspaceId?: string, enabled = true) =>
  useQuery({
    queryKey: ["overview", "company", workspaceId],
    queryFn: () => overviewApi.company(workspaceId as string),
    enabled: !!workspaceId && enabled,
    refetchInterval: 60_000,
  });

export const useAuditLog = (workspaceId?: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: ["overview", "audit", workspaceId],
    queryFn: ({ pageParam }) =>
      overviewApi.audit(workspaceId as string, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.nextBefore ? String(last.nextBefore) : null,
    enabled: !!workspaceId && enabled,
  });
