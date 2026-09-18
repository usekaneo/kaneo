import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AttendanceDay } from "@/fetchers/attendance";
import {
  useCreateAttendanceSession,
  useDeleteAttendanceSession,
  useUpdateAttendanceSession,
} from "@/hooks/mutations/attendance/use-attendance-mutations";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { zonedClock, zonedInstant } from "@/lib/zoned-time";

type Draft = { id: string | null; from: string; to: string };

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  timeZone: string;
  day: AttendanceDay | null;
};

// Admin corrections for one day: fix a forgotten clock-out, add a missed
// session, or remove a mistaken one. Times are in the workspace timezone.
export function EditDayDialog({
  open,
  onClose,
  workspaceId,
  userId,
  timeZone,
  day,
}: Props) {
  const { t } = useTranslation();
  const create = useCreateAttendanceSession();
  const update = useUpdateAttendanceSession();
  const remove = useDeleteAttendanceSession(workspaceId);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    if (!open || !day) return;
    setDrafts(
      day.sessions.map((s) => ({
        id: s.id,
        from: zonedClock(s.clockIn, timeZone),
        to: s.clockOut ? zonedClock(s.clockOut, timeZone) : "",
      })),
    );
  }, [open, day, timeZone]);

  if (!day) return null;

  const save = async () => {
    try {
      for (const draft of drafts) {
        if (!draft.from) continue;
        const clockIn = zonedInstant(
          day.day,
          draft.from,
          timeZone,
        ).toISOString();
        const clockOut = draft.to
          ? zonedInstant(day.day, draft.to, timeZone).toISOString()
          : null;
        if (clockOut && clockOut <= clockIn) {
          toast.error(t("attendance:edit.outBeforeIn"));
          return;
        }
        if (draft.id) {
          await update.mutateAsync({
            id: draft.id,
            workspaceId,
            clockIn,
            clockOut,
          });
        } else {
          await create.mutateAsync({
            workspaceId,
            userId,
            clockIn,
            clockOut: clockOut ?? undefined,
          });
        }
      }
      toast.success(t("attendance:edit.saved"));
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("attendance:edit.error"),
      );
    }
  };

  const drop = async (draft: Draft, index: number) => {
    if (draft.id) {
      try {
        await remove.mutateAsync(draft.id);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("attendance:edit.error"),
        );
        return;
      }
    }
    setDrafts((all) => all.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("attendance:edit.title", { date: formatDateMedium(day.day) })}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("attendance:edit.hint", { timeZone })}
          </p>
          {drafts.map((draft, index) => (
            <div
              key={draft.id ?? `new-${index}`}
              className="flex items-center gap-2"
            >
              <Input
                type="time"
                aria-label={t("attendance:table.in")}
                value={draft.from}
                onChange={(e) =>
                  setDrafts((all) =>
                    all.map((d, i) =>
                      i === index ? { ...d, from: e.target.value } : d,
                    ),
                  )
                }
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                aria-label={t("attendance:table.out")}
                value={draft.to}
                onChange={(e) =>
                  setDrafts((all) =>
                    all.map((d, i) =>
                      i === index ? { ...d, to: e.target.value } : d,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("attendance:edit.remove")}
                onClick={() => drop(draft, index)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-muted-foreground"
            onClick={() =>
              setDrafts((all) => [...all, { id: null, from: "", to: "" }])
            }
          >
            <Plus className="size-3.5" />
            {t("attendance:edit.add")}
          </Button>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={create.isPending || update.isPending}
          >
            {t("attendance:edit.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
