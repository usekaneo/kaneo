import { CalendarDays, HeartPulse, Palmtree, Wallet } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRequestActions } from "@/hooks/mutations/company-os";
import { useLeaveBalance, useLeavePreview } from "@/hooks/queries/company-os";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { leaveTypeLabel } from "./labels";

const TYPES = [
  { value: "annual", icon: Palmtree },
  { value: "sick", icon: HeartPulse },
  { value: "unpaid", icon: Wallet },
] as const;
type LeaveType = (typeof TYPES)[number]["value"];

export function RequestLeaveDialog({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { requestLeave } = useRequestActions(workspaceId);
  const { data: balance } = useLeaveBalance(open ? workspaceId : undefined);
  const [type, setType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const lastDay = endDate || startDate;
  const { data: preview, error: previewError } = useLeavePreview(
    open ? workspaceId : undefined,
    startDate,
    lastDay,
  );

  useEffect(() => {
    if (!open) return;
    setType("annual");
    setStartDate("");
    setEndDate("");
    setReason("");
  }, [open]);

  // Annual and sick leave come out of the yearly allowance; unpaid doesn't.
  const counted = type !== "unpaid";
  const days = preview?.days ?? null;
  const left =
    balance && days !== null
      ? balance.available - balance.pending - days
      : null;
  const overBalance = counted && left !== null && left < 0;

  const save = async () => {
    if (!startDate) {
      toast.error(t("requests:leave.pickDates"));
      return;
    }
    try {
      const created = await requestLeave.mutateAsync({
        workspaceId,
        type,
        startDate,
        endDate: lastDay,
        reason: reason.trim() || undefined,
      });
      toast.success(t("requests:leave.sent", { count: created.days }));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requests:error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("requests:leave.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("requests:leave.type")}</Label>
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className="sr-only">{t("requests:leave.type")}</legend>
              {TYPES.map(({ value, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-sm transition-colors hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring",
                    type === value
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-type`}
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                    className="sr-only"
                  />
                  <Icon className="size-4" />
                  {leaveTypeLabel(t, value)}
                </label>
              ))}
            </fieldset>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-from`}>{t("requests:leave.from")}</Label>
              <Input
                id={`${id}-from`}
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate("");
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-to`}>{t("requests:leave.to")}</Label>
              <Input
                id={`${id}-to`}
                type="date"
                min={startDate || undefined}
                value={endDate}
                placeholder={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {startDate && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                overBalance || previewError || days === 0
                  ? "border-warning/40 bg-warning/8"
                  : "border-border bg-muted/40",
              )}
            >
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="space-y-0.5">
                {previewError ? (
                  <p>{previewError.message}</p>
                ) : days === null ? (
                  <p className="text-muted-foreground">…</p>
                ) : days === 0 ? (
                  <p>{t("requests:leave.noWorkingDays")}</p>
                ) : (
                  <p className="font-medium">
                    {t("requests:leave.days", { count: days })}
                  </p>
                )}
                {counted && balance && days !== null && days > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {overBalance
                      ? t("requests:leave.overBalance", {
                          available: balance.available - balance.pending,
                        })
                      : t("requests:leave.afterThis", { count: left ?? 0 })}
                  </p>
                )}
                {!counted && (
                  <p className="text-muted-foreground text-xs">
                    {t("requests:leave.unpaidHint")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor={`${id}-reason`}>{t("requests:leave.reason")}</Label>
            <Textarea
              id={`${id}-reason`}
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("requests:leave.reasonPlaceholder")}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {t("requests:leave.approvalHint")}
          </p>
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" size="sm" type="button" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button
            size="sm"
            onClick={save}
            disabled={requestLeave.isPending || !startDate || days === 0}
          >
            {t("requests:leave.send")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
