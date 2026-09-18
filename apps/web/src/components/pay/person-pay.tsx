import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { usePayslips, useSalaryHistory } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { formatHours } from "@/lib/format-duration";
import { formatMoney } from "@/lib/money";
import { AddSalaryDialog } from "./add-salary-dialog";
import { monthLabel, payrollStatusLabel, payrollStatusVariant } from "./labels";

type Props = {
  workspaceId: string;
  userId: string;
  name: string;
};

// A person's salary history and payslips. Private: the person themself and
// people with payroll access.
export function PersonPay({ workspaceId, userId, name }: Props) {
  const { t, i18n } = useTranslation();
  const { data: company } = useCompanySettings(workspaceId);
  const { data: salaries = [] } = useSalaryHistory(workspaceId, userId);
  const { data: slips = [] } = usePayslips(workspaceId, userId);
  const { canManagePay } = useWorkspacePermission();
  const [adding, setAdding] = useState(false);
  const currency = company?.currency ?? "USD";
  const money = (minor: number, cur = currency) =>
    formatMoney(minor, cur, i18n.language);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {t("pay:salary.historyTitle")}
          </h3>
          {canManagePay() && (
            <Button
              variant="outline"
              size="xs"
              className="gap-1"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3" />
              {t("pay:salary.change")}
            </Button>
          )}
        </div>
        {salaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("pay:salary.none")}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {salaries.map((salary, index) => (
              <li
                key={salary.id}
                className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {money(salary.amount)}
                  </span>
                  <span className="text-muted-foreground">
                    {salary.type === "hourly"
                      ? t("pay:salary.perHour")
                      : t("pay:salary.perMonth")}
                  </span>
                  {index === 0 && (
                    <Badge variant="secondary">{t("pay:salary.current")}</Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("pay:salary.since", {
                    date: formatDateMedium(salary.effectiveFrom),
                  })}
                  {salary.note ? ` · ${salary.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("pay:payslips.title")}</h3>
        {slips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("pay:payslips.none")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">
                    {t("pay:columns.month")}
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
                  <TableHead className="text-right">
                    {t("pay:columns.net")}
                  </TableHead>
                  <TableHead className="pe-4 text-right">
                    {t("pay:columns.status")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.map((slip) => (
                  <TableRow key={slip.runId}>
                    <TableCell className="ps-4">
                      {monthLabel(i18n.language, slip.year, slip.month)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(slip.baseAmount, slip.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {slip.overtimeAmount > 0
                        ? `${money(slip.overtimeAmount, slip.currency)} (${formatHours(slip.overtimeMinutes * 60)})`
                        : "–"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {slip.bonus > 0 ? money(slip.bonus, slip.currency) : "–"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {slip.deduction > 0
                        ? money(slip.deduction, slip.currency)
                        : "–"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(slip.netAmount, slip.currency)}
                    </TableCell>
                    <TableCell className="pe-4 text-right">
                      <Badge variant={payrollStatusVariant(slip.status)}>
                        {payrollStatusLabel(t, slip.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AddSalaryDialog
        open={adding}
        onClose={() => setAdding(false)}
        workspaceId={workspaceId}
        userId={userId}
        name={name}
        currency={currency}
      />
    </div>
  );
}
