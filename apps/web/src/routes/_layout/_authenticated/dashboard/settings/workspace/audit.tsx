import { createFileRoute } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useAuditLog } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/audit",
)({
  component: RouteComponent,
});

function actionLabel(t: TFunction, action: string) {
  switch (action) {
    case "salary.added":
      return t("audit:actions.salaryAdded");
    case "payroll.created":
      return t("audit:actions.payrollCreated");
    case "payroll.recalculated":
      return t("audit:actions.payrollRecalculated");
    case "payroll.line_updated":
      return t("audit:actions.payrollLineUpdated");
    case "payroll.approved":
      return t("audit:actions.payrollApproved");
    case "payroll.paid":
      return t("audit:actions.payrollPaid");
    case "payroll.deleted":
      return t("audit:actions.payrollDeleted");
    case "leave.approved":
      return t("audit:actions.leaveApproved");
    case "leave.rejected":
      return t("audit:actions.leaveRejected");
    case "expense.approved":
      return t("audit:actions.expenseApproved");
    case "expense.rejected":
      return t("audit:actions.expenseRejected");
    case "expense.paid":
      return t("audit:actions.expensePaid");
    case "person.updated":
      return t("audit:actions.personUpdated");
    case "attendance.created":
    case "attendance.updated":
    case "attendance.deleted":
      return t("audit:actions.attendanceCorrected");
    case "device.revoked":
      return t("audit:actions.deviceRevoked");
    case "member.invited":
      return t("audit:actions.memberInvited");
    case "member.role_changed":
      return t("audit:actions.roleChanged");
    case "member.removed":
      return t("audit:actions.memberRemoved");
    case "role.created":
    case "role.updated":
    case "role.deleted":
      return t("audit:actions.roleEdited");
    case "company_settings.updated":
      return t("audit:actions.companySettingsUpdated");
    case "department.created":
    case "department.deleted":
      return t("audit:actions.departmentsChanged");
    default:
      return action;
  }
}

// Raw details stay one click away; the list reads as plain sentences.
function Details({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
    return null;
  }
  return (
    <div>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "−" : "+"}
      </button>
      {open && (
        <pre className="mt-1 max-w-full overflow-x-auto rounded bg-muted p-2 text-[11px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, canReadAudit } = useWorkspacePermission();
  const allowed = Boolean(canReadAudit());
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useAuditLog(
    workspace?.id,
    allowed,
  );
  const entries = data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <>
      <PageTitle title={t("audit:title")} />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("audit:title")}</h1>
          <p className="text-muted-foreground">{t("audit:subtitle")}</p>
        </div>
        {!allowed ? (
          <p className="text-sm text-muted-foreground">{t("audit:noAccess")}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("audit:empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {entries.map((entry) => (
              <li key={entry.id} className="space-y-1 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium">
                      {entry.actorName ?? t("audit:someone")}
                    </span>{" "}
                    {actionLabel(t, entry.action)}
                    {entry.targetName && (
                      <span className="text-muted-foreground">
                        {" · "}
                        {entry.targetName}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <Details data={entry.data} />
              </li>
            ))}
          </ul>
        )}
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {t("audit:more")}
          </Button>
        )}
      </div>
    </>
  );
}
