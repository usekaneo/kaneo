import { Check, X } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useRequestActions } from "@/hooks/mutations/company-os";
import { toast } from "@/lib/toast";

/** Approve in one click; rejecting asks for a reason the person will see. */
export function DecideLeave({
  workspaceId,
  requestId,
  userName,
}: {
  workspaceId: string;
  requestId: string;
  userName: string;
}) {
  const { t } = useTranslation();
  const { decideLeave } = useRequestActions(workspaceId);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const decide = async (decision: "approved" | "rejected") => {
    try {
      await decideLeave.mutateAsync({
        id: requestId,
        decision,
        note: note.trim() || undefined,
      });
      toast.success(
        decision === "approved"
          ? t("requests:approvals.approvedToast", { name: userName })
          : t("requests:approvals.rejectedToast", { name: userName }),
      );
      setRejecting(false);
      setNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requests:error"));
    }
  };

  return (
    <>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="xs"
          className="gap-1"
          disabled={decideLeave.isPending}
          onClick={() => setRejecting(true)}
        >
          <X className="size-3" />
          {t("requests:approvals.reject")}
        </Button>
        <Button
          size="xs"
          className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
          disabled={decideLeave.isPending}
          onClick={() => decide("approved")}
        >
          <Check className="size-3" />
          {t("requests:approvals.approve")}
        </Button>
      </div>
      <Dialog
        open={rejecting}
        onOpenChange={(open) => !open && setRejecting(false)}
      >
        <DialogPopup className="w-full max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("requests:approvals.rejectTitle", { name: userName })}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Textarea
              autoFocus
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("requests:approvals.rejectNote")}
              aria-label={t("requests:approvals.rejectNote")}
            />
          </DialogPanel>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejecting(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={decideLeave.isPending}
              onClick={() => decide("rejected")}
            >
              {t("requests:approvals.reject")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
