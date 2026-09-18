import { Palmtree } from "lucide-react";
import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeaveHistoryFilters } from "@/fetchers/requests";
import { useRequestActions } from "@/hooks/mutations/company-os";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { useAllLeave, useOpenRequests } from "@/hooks/queries/company-os";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { addDaysToDay, zonedDay } from "@/lib/zoned-time";
import { DecideLeave } from "./decide-leave";
import {
  leaveTypeLabel,
  requestStatusLabel,
  requestStatusVariant,
} from "./labels";
import { formatRange } from "./my-leave";

const STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
      {children}
    </h3>
  );
}

// For approvers: what's waiting, who's out soon, and everything that
// happened before, with who decided it.
export function LeaveBoard({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: company } = useCompanySettings(workspaceId);
  const today = zonedDay(new Date(), company?.timezone ?? "UTC");
  const { data: open } = useOpenRequests(workspaceId);
  const { data: upcoming = [] } = useAllLeave(
    workspaceId,
    { status: "approved", from: today, to: addDaysToDay(today, 13) },
    Boolean(company),
  );
  const [status, setStatus] = useState<Status | null>(null);
  const filters: LeaveHistoryFilters = status ? { status } : {};
  const { data: history = [] } = useAllLeave(workspaceId, filters);
  const { cancelLeave } = useRequestActions(workspaceId);

  const pending = open?.leave ?? [];

  const callOff = (id: string) =>
    cancelLeave
      .mutateAsync(id)
      .then(() => toast.success(t("requests:leave.calledOff")))
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : t("requests:error"),
        ),
      );

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-2">
          <Heading>
            {t("requests:approvals.leave")}
            {pending.length > 0 && ` · ${pending.length}`}
          </Heading>
          {pending.length === 0 ? (
            <Empty className="rounded-lg border border-border border-dashed py-8">
              <EmptyHeader>
                <EmptyTitle>{t("requests:approvals.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("requests:approvals.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pending.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{request.userName}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {leaveTypeLabel(t, request.type)}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRange(request.startDate, request.endDate)}
                      {" · "}
                      {t("requests:leave.days", { count: request.days })}
                      {" · "}
                      {t("requests:leave.askedOn", {
                        date: formatDateMedium(request.createdAt),
                      })}
                    </p>
                    {request.reason && (
                      <p className="text-sm">“{request.reason}”</p>
                    )}
                  </div>
                  {request.userId !== user?.id ? (
                    <DecideLeave
                      workspaceId={workspaceId}
                      requestId={request.id}
                      userName={request.userName}
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {t("requests:approvals.ownRequest")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <Heading>{t("requests:leave.whoIsOut")}</Heading>
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
              {t("requests:leave.nobodyOut")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...upcoming]
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .map((request) => {
                  const now =
                    request.startDate <= today && today <= request.endDate;
                  return (
                    <li
                      key={request.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2",
                        now
                          ? "border-sky-500/30 bg-sky-500/8"
                          : "border-border",
                      )}
                    >
                      <Palmtree className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {request.userName}
                        </p>
                        <p className="truncate text-muted-foreground text-xs">
                          {formatRange(request.startDate, request.endDate)}
                        </p>
                      </div>
                      {now && (
                        <Badge variant="info">
                          {t("requests:leave.outNow")}
                        </Badge>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Heading>{t("requests:leave.history")}</Heading>
          <div className="flex flex-wrap gap-1">
            {[null, ...STATUSES].map((value) => (
              <Button
                key={value ?? "all"}
                size="xs"
                variant={status === value ? "default" : "outline"}
                onClick={() => setStatus(value)}
              >
                {value ? requestStatusLabel(t, value) : t("requests:leave.all")}
              </Button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            {t("requests:leave.none")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">
                    {t("attendance:table.person")}
                  </TableHead>
                  <TableHead>{t("requests:leave.type")}</TableHead>
                  <TableHead>{t("requests:leave.dates")}</TableHead>
                  <TableHead className="text-right">
                    {t("requests:leave.daysColumn")}
                  </TableHead>
                  <TableHead>{t("attendance:table.status")}</TableHead>
                  <TableHead>{t("requests:leave.decidedBy")}</TableHead>
                  <TableHead className="w-px pe-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="ps-4 font-medium">
                      {request.userName}
                    </TableCell>
                    <TableCell>{leaveTypeLabel(t, request.type)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatRange(request.startDate, request.endDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {request.days}
                    </TableCell>
                    <TableCell>
                      <Badge variant={requestStatusVariant(request.status)}>
                        {requestStatusLabel(t, request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.decidedByName ? (
                        <span title={request.decisionNote ?? undefined}>
                          {request.decidedByName}
                          {request.decidedAt &&
                            ` · ${formatDateMedium(request.decidedAt)}`}
                        </span>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell className="pe-4 text-right">
                      {/* Pending ones are decided in the list above. */}
                      {request.status === "approved" &&
                      request.endDate >= today ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={cancelLeave.isPending}
                          onClick={() => callOff(request.id)}
                        >
                          {t("requests:leave.callOff")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
