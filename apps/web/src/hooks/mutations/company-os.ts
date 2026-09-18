import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AddSalaryRequest, payApi } from "@/fetchers/pay";
import {
  type ExpenseBody,
  type LeaveRequestBody,
  requestsApi,
} from "@/fetchers/requests";

function useRefresh(...prefixes: string[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const prefix of prefixes) {
      queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };
}

export function useAddSalary() {
  const onSuccess = useRefresh("pay");
  return useMutation({
    mutationFn: (json: AddSalaryRequest) => payApi.addSalary(json),
    onSuccess,
  });
}

export function usePayrollActions(workspaceId: string) {
  const onSuccess = useRefresh("pay", "overview");
  return {
    create: useMutation({
      mutationFn: ({ year, month }: { year: number; month: number }) =>
        payApi.createRun(workspaceId, year, month),
      onSuccess,
    }),
    recalculate: useMutation({
      mutationFn: (id: string) => payApi.recalculate(workspaceId, id),
      onSuccess,
    }),
    updateItem: useMutation({
      mutationFn: ({
        id,
        itemId,
        ...input
      }: {
        id: string;
        itemId: string;
        bonus: number;
        deduction: number;
        note?: string | null;
      }) => payApi.updateItem(workspaceId, id, itemId, input),
      onSuccess,
    }),
    approve: useMutation({
      mutationFn: (id: string) => payApi.approve(workspaceId, id),
      onSuccess,
    }),
    markPaid: useMutation({
      mutationFn: (id: string) => payApi.markPaid(workspaceId, id),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => payApi.deleteRun(workspaceId, id),
      onSuccess,
    }),
  };
}

export function useRequestActions(workspaceId: string) {
  // Leave decisions change attendance days (on leave vs absent) too.
  const onSuccess = useRefresh("requests", "overview", "attendance");
  return {
    requestLeave: useMutation({
      mutationFn: (json: LeaveRequestBody) => requestsApi.requestLeave(json),
      onSuccess,
    }),
    cancelLeave: useMutation({
      mutationFn: (id: string) => requestsApi.cancelLeave(workspaceId, id),
      onSuccess,
    }),
    decideLeave: useMutation({
      mutationFn: ({
        id,
        decision,
        note,
      }: {
        id: string;
        decision: "approved" | "rejected";
        note?: string;
      }) => requestsApi.decideLeave(workspaceId, id, decision, note),
      onSuccess,
    }),
    submitExpense: useMutation({
      mutationFn: (json: ExpenseBody) => requestsApi.submitExpense(json),
      onSuccess,
    }),
    cancelExpense: useMutation({
      mutationFn: (id: string) => requestsApi.cancelExpense(workspaceId, id),
      onSuccess,
    }),
    decideExpense: useMutation({
      mutationFn: ({
        id,
        decision,
      }: {
        id: string;
        decision: "approved" | "rejected";
      }) => requestsApi.decideExpense(workspaceId, id, decision),
      onSuccess,
    }),
    markExpensePaid: useMutation({
      mutationFn: (id: string) => requestsApi.markExpensePaid(workspaceId, id),
      onSuccess,
    }),
    uploadReceipt: useMutation({
      mutationFn: (file: File) => requestsApi.uploadReceipt(workspaceId, file),
    }),
  };
}
