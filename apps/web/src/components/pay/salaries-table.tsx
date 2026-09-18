import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AddSalaryDialog } from "@/components/pay/add-salary-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentSalaries } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export function SalariesTable({
  workspaceId,
  currency,
}: {
  workspaceId: string;
  currency: string;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { canManagePay } = useWorkspacePermission();
  const { data: salaries = [] } = useCurrentSalaries(workspaceId);
  const [salaryFor, setSalaryFor] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">{t("pay:columns.person")}</TableHead>
              <TableHead className="text-right">
                {t("pay:columns.salary")}
              </TableHead>
              <TableHead>{t("pay:columns.since")}</TableHead>
              <TableHead className="w-px pe-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaries.map((row) => (
              <TableRow key={row.userId}>
                <TableCell className="ps-4">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() =>
                      navigate({
                        to: "/dashboard/workspace/$workspaceId/people/$userId",
                        params: { workspaceId, userId: row.userId },
                      })
                    }
                  >
                    {row.name}
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.amount !== null ? (
                    <>
                      {formatMoney(row.amount, currency, i18n.language)}
                      <span className="ms-1 text-xs text-muted-foreground">
                        {row.type === "hourly"
                          ? t("pay:salary.perHour")
                          : t("pay:salary.perMonth")}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("pay:salary.notSet")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.effectiveFrom
                    ? formatDateMedium(row.effectiveFrom)
                    : "–"}
                </TableCell>
                <TableCell className="pe-4 text-right">
                  {canManagePay() && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setSalaryFor({ userId: row.userId, name: row.name })
                      }
                    >
                      {row.amount !== null
                        ? t("pay:salary.change")
                        : t("pay:salary.set")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {salaryFor && (
        <AddSalaryDialog
          open
          onClose={() => setSalaryFor(null)}
          workspaceId={workspaceId}
          userId={salaryFor.userId}
          name={salaryFor.name}
          currency={currency}
        />
      )}
    </>
  );
}
