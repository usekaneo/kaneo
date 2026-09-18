import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { CompanyToday } from "@/components/my-work/company-today";
import { CreateQuickTaskDialog } from "@/components/my-work/create-quick-task-dialog";
import { MyTasksTable } from "@/components/my-work/my-tasks-table";
import PageTitle from "@/components/page-title";
import { monthLabel } from "@/components/pay/labels";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { AddExpenseDialog } from "@/components/requests/add-expense-dialog";
import {
  leaveTypeLabel,
  requestStatusLabel,
  requestStatusVariant,
} from "@/components/requests/labels";
import { RequestLeaveDialog } from "@/components/requests/request-leave-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/mutations/company-os";
import { useActivitySummary } from "@/hooks/queries/agent/use-agent";
import { useAttendanceStatus } from "@/hooks/queries/attendance/use-attendance";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import {
  useExpenses,
  useLeaveBalance,
  useLeaveRequests,
  usePayslips,
} from "@/hooks/queries/company-os";
import usePersonTasks from "@/hooks/queries/people/use-person-tasks";
import useListTimeEntries from "@/hooks/queries/time-entry/use-list-time-entries";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { formatHours } from "@/lib/format-duration";
import { formatMoney } from "@/lib/money";
import { entrySeconds } from "@/lib/timesheet";
import { toast } from "@/lib/toast";
import { zonedDay, zonedInstant } from "@/lib/zoned-time";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-work",
)({
  component: RouteComponent,
});

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function RouteComponent() {
  const { t, i18n } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { canSeePeople, canCreateTasks } = useWorkspacePermission();
  const { data: company } = useCompanySettings(workspaceId);
  const timeZone = company?.timezone ?? "UTC";
  const currency = company?.currency ?? "USD";
  const today = zonedDay(new Date(), timeZone);

  const { data: tasks = [] } = usePersonTasks(workspaceId, userId);
  const { data: attendance } = useAttendanceStatus(workspaceId);
  const timeQuery = useMemo(
    () => ({
      workspaceId,
      from: zonedInstant(today, "00:00", timeZone).toISOString(),
      to: zonedInstant(today, "23:59", timeZone).toISOString(),
      userId,
    }),
    [workspaceId, today, timeZone, userId],
  );
  const { data: entries = [] } = useListTimeEntries(userId ? timeQuery : null);
  const { data: activity } = useActivitySummary({
    workspaceId,
    from: today,
    to: today,
  });
  const { data: balance } = useLeaveBalance(workspaceId);
  const { data: leave = [] } = useLeaveRequests(workspaceId);
  const { data: expenses = [] } = useExpenses(workspaceId);
  const { data: payslips = [] } = usePayslips(workspaceId);
  const { cancelLeave, cancelExpense } = useRequestActions(workspaceId);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const now = new Date();
  const tracked = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
  const latestSlip = payslips[0];

  const act = (fn: () => Promise<unknown>) =>
    fn().catch((error) =>
      toast.error(error instanceof Error ? error.message : t("requests:error")),
    );

  return (
    <>
      <PageTitle title={t("myWork:title")} />
      <WorkspaceLayout title={t("myWork:title")}>
        <div className="space-y-8 p-4">
          {canSeePeople() && <CompanyToday workspaceId={workspaceId} />}

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <Section
              title={t("myWork:tasks.title")}
              action={
                <div className="flex items-center gap-3">
                  <Link
                    to="/dashboard/workspace/$workspaceId/people/$userId"
                    params={{ workspaceId, userId }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("myWork:tasks.profile")}
                  </Link>
                  {canCreateTasks() && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setTaskOpen(true)}
                    >
                      {t("myWork:tasks.new")}
                    </Button>
                  )}
                </div>
              }
            >
              <MyTasksTable
                workspaceId={workspaceId}
                userId={userId}
                tasks={tasks}
              />
            </Section>

            <div className="space-y-8">
              <Section title={t("myWork:today.title")}>
                <div className="divide-y divide-border">
                  <Fact
                    label={t("myWork:today.attendance")}
                    value={
                      attendance?.clockedIn
                        ? t("myWork:today.clockedIn")
                        : attendance?.today.sessions.length
                          ? t("myWork:today.clockedOut")
                          : t("myWork:today.notYet")
                    }
                  />
                  <Fact
                    label={t("myWork:today.worked")}
                    value={formatHours(
                      (attendance?.today.workedMinutes ?? 0) * 60,
                    )}
                  />
                  <Fact
                    label={t("myWork:today.tracked")}
                    value={formatHours(tracked)}
                  />
                  {activity &&
                    activity.activeSeconds + activity.idleSeconds > 0 && (
                      <Fact
                        label={t("myWork:today.activeIdle")}
                        value={`${formatHours(activity.activeSeconds)} / ${formatHours(activity.idleSeconds)}`}
                      />
                    )}
                  {(attendance?.today.overtimeMinutes ?? 0) > 0 && (
                    <Fact
                      label={t("myWork:today.overtime")}
                      value={formatHours(
                        (attendance?.today.overtimeMinutes ?? 0) * 60,
                      )}
                    />
                  )}
                </div>
              </Section>

              <Section
                title={t("myWork:leave.title")}
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setLeaveOpen(true)}
                  >
                    {t("myWork:leave.request")}
                  </Button>
                }
              >
                {balance && (
                  <p className="text-sm text-muted-foreground">
                    {t("myWork:leave.balance", {
                      available: balance.available,
                      used: balance.used,
                      pending: balance.pending,
                    })}
                  </p>
                )}
                <ul className="space-y-1">
                  {leave.slice(0, 4).map((request) => (
                    <li
                      key={request.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {leaveTypeLabel(t, request.type)}
                        <span className="text-muted-foreground">
                          {" · "}
                          {formatDateMedium(request.startDate)}
                          {request.endDate !== request.startDate &&
                            ` – ${formatDateMedium(request.endDate)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Badge variant={requestStatusVariant(request.status)}>
                          {requestStatusLabel(t, request.status)}
                        </Badge>
                        {request.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              act(() => cancelLeave.mutateAsync(request.id))
                            }
                          >
                            {t("myWork:cancel")}
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                title={t("myWork:expenses.title")}
                action={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setExpenseOpen(true)}
                  >
                    {t("myWork:expenses.add")}
                  </Button>
                }
              >
                {expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("myWork:expenses.none")}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {expenses.slice(0, 4).map((expense) => (
                      <li
                        key={expense.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          <span className="tabular-nums">
                            {formatMoney(
                              expense.amount,
                              expense.currency,
                              i18n.language,
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {expense.category}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Badge variant={requestStatusVariant(expense.status)}>
                            {requestStatusLabel(t, expense.status)}
                          </Badge>
                          {expense.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                act(() => cancelExpense.mutateAsync(expense.id))
                              }
                            >
                              {t("myWork:cancel")}
                            </Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={t("myWork:pay.title")}>
                {latestSlip ? (
                  <Fact
                    label={monthLabel(
                      i18n.language,
                      latestSlip.year,
                      latestSlip.month,
                    )}
                    value={formatMoney(
                      latestSlip.netAmount,
                      latestSlip.currency,
                      i18n.language,
                    )}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("myWork:pay.none")}
                  </p>
                )}
              </Section>
            </div>
          </div>
        </div>

        <CreateQuickTaskDialog
          open={taskOpen}
          onClose={() => setTaskOpen(false)}
          workspaceId={workspaceId}
        />
        <RequestLeaveDialog
          open={leaveOpen}
          onClose={() => setLeaveOpen(false)}
          workspaceId={workspaceId}
        />
        <AddExpenseDialog
          open={expenseOpen}
          onClose={() => setExpenseOpen(false)}
          workspaceId={workspaceId}
          currency={currency}
        />
      </WorkspaceLayout>
    </>
  );
}
