import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ensureTaskShare,
  getSharedTaskUrl,
  revokeTaskShare,
} from "@/fetchers/task-share";
import { useGetTaskShare } from "@/hooks/queries/task/use-get-task-share";
import { toast } from "@/lib/toast";

type TaskShareDialogProps = {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function TaskShareDialog({
  taskId,
  open,
  onOpenChange,
}: TaskShareDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["task-share", taskId];
  const shareQuery = useGetTaskShare(taskId, open);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const share = shareQuery.data?.share;
  const url = share ? getSharedTaskUrl(share.token) : "";

  useEffect(() => {
    if (!open) setConfirmingRevoke(false);
  }, [open]);

  const create = useMutation({
    mutationFn: () => ensureTaskShare(taskId),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKey, { share: created });
      toast.success(t("tasks:share.created"));
    },
    onError: () => toast.error(t("tasks:share.createError")),
  });

  const revoke = useMutation({
    mutationFn: () => revokeTaskShare(taskId),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, { share: null });
      setConfirmingRevoke(false);
      toast.success(t("tasks:share.revoked"));
    },
    onError: () => toast.error(t("tasks:share.revokeError")),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("tasks:share.copied"));
    } catch {
      toast.error(t("tasks:share.copyError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("tasks:share.title")}</DialogTitle>
          <DialogDescription>{t("tasks:share.description")}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          {shareQuery.isLoading && (
            <p className="text-sm text-muted-foreground" role="status">
              {t("common:empty.loading")}
            </p>
          )}
          {shareQuery.isError && (
            <div className="space-y-3" role="alert">
              <p className="text-sm text-destructive">
                {t("tasks:share.loadError")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void shareQuery.refetch()}
              >
                {t("tasks:share.retry")}
              </Button>
            </div>
          )}
          {!shareQuery.isLoading && !shareQuery.isError && !share && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("tasks:share.accessWarning")}
              </p>
              <Button
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {t(
                  create.isPending
                    ? "tasks:share.creating"
                    : "tasks:share.create",
                )}
              </Button>
            </div>
          )}
          {share && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("tasks:share.activeHint")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label={t("tasks:share.url")}
                  readOnly
                  value={url}
                  className="min-w-0 flex-1"
                  onFocus={(event) => event.target.select()}
                />
                <Button variant="outline" onClick={() => void copy()}>
                  {t("tasks:share.copy")}
                </Button>
              </div>
              {confirmingRevoke ? (
                <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm text-foreground">
                    {t("tasks:share.revokeConfirmation")}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => setConfirmingRevoke(false)}
                    >
                      {t("common:actions.cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate()}
                    >
                      {t(
                        revoke.isPending
                          ? "tasks:share.revoking"
                          : "tasks:share.revoke",
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmingRevoke(true)}
                >
                  {t("tasks:share.revoke")}
                </Button>
              )}
            </div>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.close")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
