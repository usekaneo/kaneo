import { useNavigate } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  monthLabel,
  payrollStatusLabel,
  payrollStatusVariant,
} from "@/components/pay/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayrollActions } from "@/hooks/mutations/company-os";
import { usePayrollRuns } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatMoney } from "@/lib/money";
import { toast } from "@/lib/toast";

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export function PayrollRuns({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { canManagePay } = useWorkspacePermission();
  const { data: runs = [] } = usePayrollRuns(workspaceId);
  const actions = usePayrollActions(workspaceId);
  const months = lastMonths(6);
  const [period, setPeriod] = useState(() => {
    const m = months[1] ?? months[0];
    return `${m?.year}-${m?.month}`;
  });
  const [selectedYear, selectedMonth] = period.split("-").map(Number);

  const create = async () => {
    try {
      const run = await actions.create.mutateAsync({
        year: selectedYear as number,
        month: selectedMonth as number,
      });
      navigate({
        to: "/dashboard/workspace/$workspaceId/payroll/$runId",
        params: { workspaceId, runId: run.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pay:error"));
    }
  };

  return (
    <div className="space-y-3">
      {canManagePay() && (
        <div className="flex items-center justify-end gap-1.5">
          <Select
            value={period}
            onValueChange={(value) => {
              if (typeof value === "string") setPeriod(value);
            }}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue>
                {monthLabel(
                  i18n.language,
                  selectedYear as number,
                  selectedMonth as number,
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem
                  key={`${m.year}-${m.month}`}
                  value={`${m.year}-${m.month}`}
                >
                  {monthLabel(i18n.language, m.year, m.month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="gap-1"
            onClick={create}
            disabled={actions.create.isPending}
          >
            <Plus className="size-3.5" />
            {t("pay:runs.create")}
          </Button>
        </div>
      )}

      {runs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Wallet className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t("pay:runs.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("pay:runs.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("pay:columns.month")}</TableHead>
                <TableHead>{t("pay:columns.status")}</TableHead>
                <TableHead className="text-right">
                  {t("pay:columns.people")}
                </TableHead>
                <TableHead className="pe-4 text-right">
                  {t("pay:columns.netTotal")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/workspace/$workspaceId/payroll/$runId",
                      params: { workspaceId, runId: run.id },
                    })
                  }
                >
                  <TableCell className="ps-4 font-medium">
                    {monthLabel(i18n.language, run.year, run.month)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={payrollStatusVariant(run.status)}>
                      {payrollStatusLabel(t, run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {run.people}
                  </TableCell>
                  <TableCell className="pe-4 text-right tabular-nums">
                    {formatMoney(run.netTotal, run.currency, i18n.language)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
