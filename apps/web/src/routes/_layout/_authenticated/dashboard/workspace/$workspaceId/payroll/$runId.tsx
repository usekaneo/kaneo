import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import {
  monthLabel,
  payrollStatusLabel,
  payrollStatusVariant,
} from "@/components/pay/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PayrollRun } from "@/fetchers/pay";
import { usePayrollActions } from "@/hooks/mutations/company-os";
import { usePayrollRun } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatHours } from "@/lib/format-duration";
import { formatMoney, moneyToInput, parseMoneyInput } from "@/lib/money";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/payroll/$runId",
)({
  component: RouteComponent,
});

type Item = PayrollRun["items"][number];

function AdjustableAmount({
  value,
  editable,
  onSave,
  format,
  label,
}: {
  value: number;
  editable: boolean;
  onSave: (minor: number) => void;
  format: (minor: number) => string;
  label: string;
}) {
  const [text, setText] = useState(moneyToInput(value));
  useEffect(() => setText(moneyToInput(value)), [value]);

  if (!editable) {
    return (
      <span className="tabular-nums">{value > 0 ? format(value) : "–"}</span>
    );
  }
  const commit = () => {
    const minor = parseMoneyInput(text || "0");
    if (minor === null) {
      setText(moneyToInput(value));
      return;
    }
    if (minor !== value) onSave(minor);
  };
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="ms-auto h-8 w-28 text-right tabular-nums"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function RouteComponent() {
  const { t, i18n } = useTranslation();
  const { workspaceId, runId } = Route.useParams();
  const navigate = useNavigate();
  const { data: run } = usePayrollRun(workspaceId, runId);
  const { canManagePay } = useWorkspacePermission();
  const actions = usePayrollActions(workspaceId);

  if (!run) return null;

  const title = monthLabel(i18n.language, run.year, run.month);
  const draft = run.status === "draft";
  const canEdit = draft && Boolean(canManagePay());
  const money = (minor: number) =>
    formatMoney(minor, run.currency, i18n.language);

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pay:error"));
    }
  };

  const save = (
    item: Item,
    patch: Partial<Pick<Item, "bonus" | "deduction">>,
  ) =>
    act(() =>
      actions.updateItem.mutateAsync({
        id: run.id,
        itemId: item.id,
        bonus: patch.bonus ?? item.bonus,
        deduction: patch.deduction ?? item.deduction,
      }),
    );

  const totals = run.items.reduce(
    (sum, i) => ({
      base: sum.base + i.baseAmount,
      overtime: sum.overtime + i.overtimeAmount,
      bonus: sum.bonus + i.bonus,
      deduction: sum.deduction + i.deduction,
      net: sum.net + i.netAmount,
    }),
    { base: 0, overtime: 0, bonus: 0, deduction: 0, net: 0 },
  );

  return (
    <>
      <PageTitle title={`${t("pay:title")} · ${title}`} />
      <WorkspaceLayout
        title={title}
        headerActions={
          canManagePay() ? (
            <div className="flex items-center gap-1.5">
              {draft && (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      act(async () => {
                        await actions.remove.mutateAsync(run.id);
                        navigate({
                          to: "/dashboard/workspace/$workspaceId/payroll",
                          params: { workspaceId },
                        });
                      })
                    }
                  >
                    {t("pay:runs.delete")}
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      act(
                        () => actions.recalculate.mutateAsync(run.id),
                        t("pay:runs.recalculated"),
                      )
                    }
                  >
                    {t("pay:runs.recalculate")}
                  </Button>
                  <Button
                    size="xs"
                    onClick={() =>
                      act(
                        () => actions.approve.mutateAsync(run.id),
                        t("pay:runs.approved"),
                      )
                    }
                  >
                    {t("pay:runs.approve")}
                  </Button>
                </>
              )}
              {run.status === "approved" && (
                <Button
                  size="xs"
                  onClick={() =>
                    act(
                      () => actions.markPaid.mutateAsync(run.id),
                      t("pay:runs.markedPaid"),
                    )
                  }
                >
                  {t("pay:runs.markPaid")}
                </Button>
              )}
            </div>
          ) : null
        }
      >
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={payrollStatusVariant(run.status)}>
              {payrollStatusLabel(t, run.status)}
            </Badge>
            {draft
              ? t("pay:runs.draftHint")
              : run.status === "approved"
                ? t("pay:runs.approvedHint")
                : t("pay:runs.paidHint")}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">
                    {t("pay:columns.person")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("pay:columns.base")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("pay:columns.overtime")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("pay:columns.bonus")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("pay:columns.deduction")}
                  </TableHead>
                  <TableHead className="pe-4 text-right">
                    {t("pay:columns.net")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="ps-4">
                      <div className="font-medium">{item.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.salaryType === "hourly"
                          ? t("pay:runs.hourlyLine", {
                              rate: money(item.salaryAmount),
                              hours: formatHours(item.workedMinutes * 60),
                            })
                          : t("pay:runs.monthlyLine", {
                              worked: formatHours(item.workedMinutes * 60),
                            })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(item.baseAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.overtimeAmount > 0 ? (
                        <>
                          {money(item.overtimeAmount)}
                          <div className="text-xs text-muted-foreground">
                            {formatHours(item.overtimeMinutes * 60)}
                          </div>
                        </>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AdjustableAmount
                        value={item.bonus}
                        editable={canEdit}
                        format={money}
                        label={t("pay:columns.bonus")}
                        onSave={(bonus) => save(item, { bonus })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <AdjustableAmount
                        value={item.deduction}
                        editable={canEdit}
                        format={money}
                        label={t("pay:columns.deduction")}
                        onSave={(deduction) => save(item, { deduction })}
                      />
                    </TableCell>
                    <TableCell className="pe-4 text-right font-medium tabular-nums">
                      {money(item.netAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="ps-4 font-medium">
                    {t("time:sheet.total")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(totals.base)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(totals.overtime)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(totals.bonus)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(totals.deduction)}
                  </TableCell>
                  <TableCell className="pe-4 text-right font-semibold tabular-nums">
                    {money(totals.net)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          {run.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("pay:runs.noSalaries")}
            </p>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
