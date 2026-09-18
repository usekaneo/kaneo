import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/mutations/company-os";
import { useLeaveBalance, useLeaveRequests } from "@/hooks/queries/company-os";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import {
  leaveTypeLabel,
  requestStatusLabel,
  requestStatusVariant,
} from "./labels";
import { RequestLeaveDialog } from "./request-leave-dialog";

export function formatRange(start: string, end: string) {
  return start === end
    ? formatDateMedium(start)
    : `${formatDateMedium(start)} – ${formatDateMedium(end)}`;
}

// Your allowance at a glance, and every request with where it stands.
export function MyLeave({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: balance } = useLeaveBalance(workspaceId);
  const { data: leave = [] } = useLeaveRequests(workspaceId);
  const { cancelLeave } = useRequestActions(workspaceId);
  const [open, setOpen] = useState(false);

  const allowance = Math.max(1, balance?.allowance ?? 0);
  const usedShare = Math.min(1, (balance?.used ?? 0) / allowance);
  const pendingShare = Math.min(
    1 - usedShare,
    (balance?.pending ?? 0) / allowance,
  );

  return (
    <section className="space-y-4 rounded-xl border border-border p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-base">{t("myWork:leave.title")}</h3>
        <Button size="xs" className="gap-1" onClick={() => setOpen(true)}>
          <Plus className="size-3" />
          {t("myWork:leave.request")}
        </Button>
      </div>

      {balance && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-3xl tabular-nums">
              {balance.available - balance.pending}
            </span>
            <span className="text-muted-foreground text-sm">
              {t("requests:balance.daysLeft", { total: balance.allowance })}
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-sky-500"
              style={{ width: `${usedShare * 100}%` }}
            />
            <div
              className="bg-sky-500/40"
              style={{ width: `${pendingShare * 100}%` }}
            />
          </div>
          <div className="flex gap-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky-500" />
              {t("requests:balance.used", { count: balance.used })}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky-500/40" />
              {t("requests:balance.pending", { count: balance.pending })}
            </span>
          </div>
        </div>
      )}

      {leave.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("requests:leave.none")}
        </p>
      ) : (
        <ul className="-mx-2 max-h-96 space-y-1 overflow-y-auto">
          {leave.map((request) => (
            <li
              key={request.id}
              className="space-y-1 rounded-lg px-2 py-2 hover:bg-accent/40"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">
                    {leaveTypeLabel(t, request.type)}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatRange(request.startDate, request.endDate)}
                    {" · "}
                    {t("requests:leave.days", { count: request.days })}
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
                      disabled={cancelLeave.isPending}
                      onClick={() =>
                        cancelLeave
                          .mutateAsync(request.id)
                          .catch((error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : t("requests:error"),
                            ),
                          )
                      }
                    >
                      {t("myWork:cancel")}
                    </Button>
                  )}
                </span>
              </div>
              {request.reason && (
                <p className="truncate text-muted-foreground text-xs">
                  {request.reason}
                </p>
              )}
              {request.decisionNote && (
                <p className="rounded-md bg-muted/60 px-2 py-1 text-xs">
                  {t("requests:leave.decisionNote", {
                    note: request.decisionNote,
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <RequestLeaveDialog
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
      />
    </section>
  );
}
