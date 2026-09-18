import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { AddSalaryDialog } from "@/components/pay/add-salary-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePayrollActions } from "@/hooks/mutations/company-os";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { useCurrentSalaries, usePayrollRuns } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/payroll/",
)({
  component: RouteComponent,
});

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

function RouteComponent() {
  const { t, i18n } = useTranslation();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { canSeePay, canManagePay } = useWorkspacePermission();
  const allowed = Boolean(canSeePay());
  const { data: company } = useCompanySettings(workspaceId);
  const { data: runs = [] } = usePayrollRuns(workspaceId, allowed);
  const { data: salaries = [] } = useCurrentSalaries(workspaceId, allowed);
  const actions = usePayrollActions(workspaceId);
  const months = lastMonths(6);
  const [period, setPeriod] = useState(() => {
    const m = months[1] ?? months[0];
    return `${m?.year}-${m?.month}`;
  });
  const [salaryFor, setSalaryFor] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const currency = company?.currency ?? "USD";
  const money = (minor: number, cur = currency) =>
    formatMoney(minor, cur, i18n.language);

  const create = async () => {
    const [year, month] = period.split("-").map(Number);
    try {
      const run = await actions.create.mutateAsync({
        year: year as number,
        month: month as number,
      });
      navigate({
        to: "/dashboard/workspace/$workspaceId/payroll/$runId",
        params: { workspaceId, runId: run.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pay:error"));
    }
  };

  if (!allowed) {
    return (
      <WorkspaceLayout title={t("pay:title")}>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("pay:noAccess")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </WorkspaceLayout>
    );
  }

  const [selectedYear, selectedMonth] = period.split("-").map(Number);

  return (
    <>
      <PageTitle title={t("pay:title")} />
      <WorkspaceLayout
        title={t("pay:title")}
        headerActions={
          canManagePay() ? (
            <div className="flex items-center gap-1.5">
              <Select
                value={period}
                onValueChange={(value) => {
                  if (typeof value === "string") setPeriod(value);
                }}
              >
                <SelectTrigger size="sm" className="h-7 w-40">
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
                size="xs"
                className="gap-1"
                onClick={create}
                disabled={actions.create.isPending}
              >
                <Plus className="size-3" />
                {t("pay:runs.create")}
              </Button>
            </div>
          ) : null
        }
      >
        <Tabs defaultValue="runs" className="pt-4">
          <TabsList className="mx-4">
            <TabsTrigger value="runs">{t("pay:tabs.runs")}</TabsTrigger>
            <TabsTrigger value="salaries">{t("pay:tabs.salaries")}</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="p-4">
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
                      <TableHead className="ps-4">
                        {t("pay:columns.month")}
                      </TableHead>
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
                          {money(run.netTotal, run.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="salaries" className="p-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">
                      {t("pay:columns.person")}
                    </TableHead>
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
                            {money(row.amount)}
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
                              setSalaryFor({
                                userId: row.userId,
                                name: row.name,
                              })
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
          </TabsContent>
        </Tabs>

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
      </WorkspaceLayout>
    </>
  );
}
