import { createFileRoute } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { CircleAlert, MailCheck, MailX, RotateCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
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
import type { EmailStatus } from "@/fetchers/email-log";
import { useEmailLog, useRetryEmail } from "@/hooks/queries/use-email-log";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/email",
)({
  component: RouteComponent,
});

const STATUSES: EmailStatus[] = ["sent", "queued", "failed"];

function statusLabel(t: TFunction, status: string) {
  switch (status) {
    case "sent":
      return t("emailLog:status.sent");
    case "failed":
      return t("emailLog:status.failed");
    case "sending":
      return t("emailLog:status.sending");
    default:
      return t("emailLog:status.queued");
  }
}

const statusVariant = (status: string) =>
  status === "sent"
    ? ("success" as const)
    : status === "failed"
      ? ("error" as const)
      : ("warning" as const);

function categoryLabel(t: TFunction, category: string) {
  switch (category.split("_")[0]) {
    case "task":
      return t("emailLog:category.task");
    case "leave":
      return t("emailLog:category.leave");
    case "expense":
      return t("emailLog:category.expense");
    case "payslip":
      return t("emailLog:category.pay");
    case "invitation":
      return t("emailLog:category.invitation");
    default:
      return t("emailLog:category.other");
  }
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, canManageWorkspace } = useWorkspacePermission();
  const [status, setStatus] = useState<EmailStatus | undefined>(undefined);
  const { data } = useEmailLog(
    canManageWorkspace() ? workspace?.id : undefined,
    status,
  );
  const retry = useRetryEmail(workspace?.id);

  const provider = data?.provider;
  const entries = data?.entries ?? [];

  if (workspace && !canManageWorkspace()) {
    return (
      <div className="mx-auto max-w-5xl py-10 text-center text-muted-foreground text-sm">
        {t("emailLog:noAccess")}
      </div>
    );
  }

  return (
    <>
      <PageTitle title={t("emailLog:title")} />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">{t("emailLog:title")}</h1>
          <p className="text-muted-foreground">{t("emailLog:subtitle")}</p>
        </div>

        {data && (
          <div
            className={
              provider
                ? "flex items-start gap-3 rounded-lg border border-border bg-sidebar p-4"
                : "flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/8 p-4"
            }
          >
            {provider ? (
              <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            ) : (
              <MailX className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
            )}
            <div className="space-y-0.5">
              <p className="font-medium text-sm">
                {provider === "resend"
                  ? t("emailLog:provider.resend")
                  : provider === "smtp"
                    ? t("emailLog:provider.smtp")
                    : t("emailLog:provider.none")}
              </p>
              <p className="text-muted-foreground text-xs">
                {provider
                  ? t("emailLog:provider.hint")
                  : t("emailLog:provider.noneHint")}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1">
          {[undefined, ...STATUSES].map((value) => (
            <Button
              key={value ?? "all"}
              size="xs"
              variant={status === value ? "default" : "outline"}
              onClick={() => setStatus(value)}
            >
              {value ? statusLabel(t, value) : t("emailLog:all")}
            </Button>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-border border-dashed py-10 text-center text-muted-foreground text-sm">
            {t("emailLog:empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">
                    {t("emailLog:columns.email")}
                  </TableHead>
                  <TableHead>{t("emailLog:columns.to")}</TableHead>
                  <TableHead>{t("emailLog:columns.status")}</TableHead>
                  <TableHead className="w-44">
                    {t("emailLog:columns.when")}
                  </TableHead>
                  <TableHead className="w-px pe-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="max-w-80 ps-4">
                      <p className="truncate font-medium" title={entry.subject}>
                        {entry.subject}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {categoryLabel(t, entry.category)}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.toEmail}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={statusVariant(entry.status)}>
                          {statusLabel(t, entry.status)}
                        </Badge>
                        {entry.lastError && entry.status !== "sent" && (
                          <p
                            className="flex max-w-64 items-start gap-1 text-destructive text-xs"
                            title={entry.lastError}
                          >
                            <CircleAlert className="mt-0.5 size-3 shrink-0" />
                            <span className="line-clamp-2">
                              {entry.lastError}
                            </span>
                          </p>
                        )}
                        {entry.attempts > 1 && (
                          <p className="text-muted-foreground text-xs">
                            {t("emailLog:attempts", {
                              count: entry.attempts,
                            })}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTime(entry.sentAt ?? entry.createdAt)}
                    </TableCell>
                    <TableCell className="pe-4 text-right">
                      {entry.status === "failed" && (
                        <Button
                          size="xs"
                          variant="outline"
                          className="gap-1"
                          disabled={retry.isPending}
                          onClick={() =>
                            retry
                              .mutateAsync(entry.id)
                              .then(() => toast.success(t("emailLog:retried")))
                              .catch((error) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : t("emailLog:error"),
                                ),
                              )
                          }
                        >
                          <RotateCw className="size-3" />
                          {t("emailLog:retry")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
