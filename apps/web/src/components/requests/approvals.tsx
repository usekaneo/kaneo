import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { receiptUrl } from "@/fetchers/requests";
import { useRequestActions } from "@/hooks/mutations/company-os";
import { useOpenRequests } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { toast } from "@/lib/toast";
import { DecideLeave } from "./decide-leave";
import {
  leaveTypeLabel,
  requestStatusLabel,
  requestStatusVariant,
} from "./labels";

// Everything waiting on someone: pending leave and expenses, and approved
// expenses still to be paid back. One list, oldest first.
export function Approvals({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { canManagePay } = useWorkspacePermission();
  const { data } = useOpenRequests(workspaceId);
  const actions = useRequestActions(workspaceId);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requests:error"));
    }
  };

  const leave = data?.leave ?? [];
  const expenses = data?.expenses ?? [];

  if (leave.length === 0 && expenses.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("requests:approvals.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {t("requests:approvals.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      {leave.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("requests:approvals.leave")}
          </h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {leave.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{request.userName}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {leaveTypeLabel(t, request.type)}
                    {" · "}
                    {formatDateMedium(request.startDate)}
                    {request.endDate !== request.startDate &&
                      ` – ${formatDateMedium(request.endDate)}`}
                    {" · "}
                    {t("requests:leave.days", { count: request.days })}
                  </span>
                  {request.reason && (
                    <p className="text-xs text-muted-foreground">
                      {request.reason}
                    </p>
                  )}
                </div>
                {request.userId !== user?.id && (
                  <DecideLeave
                    workspaceId={workspaceId}
                    requestId={request.id}
                    userName={request.userName}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {expenses.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("requests:approvals.expenses")}
          </h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{expense.userName}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    <span className="tabular-nums text-foreground">
                      {formatMoney(
                        expense.amount,
                        expense.currency,
                        i18n.language,
                      )}
                    </span>
                    {" · "}
                    {expense.category}
                    {expense.projectName ? ` · ${expense.projectName}` : ""}
                    {" · "}
                    {formatDateMedium(expense.spentOn)}
                  </span>
                  {expense.description && (
                    <p className="text-xs text-muted-foreground">
                      {expense.description}
                    </p>
                  )}
                  {expense.receiptFileId && (
                    <a
                      href={receiptUrl(workspaceId, expense.receiptFileId)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Paperclip className="size-3" />
                      {expense.receiptName ?? t("requests:expense.receipt")}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={requestStatusVariant(expense.status)}>
                    {requestStatusLabel(t, expense.status)}
                  </Badge>
                  {expense.status === "pending" &&
                    expense.userId !== user?.id && (
                      <>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() =>
                            act(() =>
                              actions.decideExpense.mutateAsync({
                                id: expense.id,
                                decision: "rejected",
                              }),
                            )
                          }
                        >
                          {t("requests:approvals.reject")}
                        </Button>
                        <Button
                          size="xs"
                          onClick={() =>
                            act(() =>
                              actions.decideExpense.mutateAsync({
                                id: expense.id,
                                decision: "approved",
                              }),
                            )
                          }
                        >
                          {t("requests:approvals.approve")}
                        </Button>
                      </>
                    )}
                  {expense.status === "approved" && canManagePay() && (
                    <Button
                      size="xs"
                      onClick={() =>
                        act(() =>
                          actions.markExpensePaid.mutateAsync(expense.id),
                        )
                      }
                    >
                      {t("requests:approvals.markPaid")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
