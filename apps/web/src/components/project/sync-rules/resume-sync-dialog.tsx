import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SyncParams } from "@/fetchers/integration-sync/types";
import { useResumeSync } from "@/hooks/mutations/integration-sync/use-resume-sync";
import { useResumePreview } from "@/hooks/queries/integration-sync/use-resume-preview";

export function ResumeSyncDialog({
  param,
  linkId,
  taskId,
  onClose,
}: {
  param: SyncParams;
  linkId: string;
  taskId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const preview = useResumePreview(param, linkId, taskId);
  const resume = useResumeSync(param, linkId);
  const data = preview.data;
  const choose = (source: "kaneo" | "provider") => {
    if (data)
      resume.mutate({ source, token: data.token }, { onSuccess: onClose });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !resume.isPending) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("settings:syncRules.reviewTitle")}</DialogTitle>
          <DialogDescription>
            {t("settings:syncRules.reviewHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {preview.isPending && (
            <p role="status">{t("common:empty.loading")}</p>
          )}
          {(preview.isError || resume.isError) && (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-destructive">
                {t("settings:syncRules.resumeError")}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resume.reset();
                  void preview.refetch();
                }}
              >
                {t("settings:syncRules.refreshComparison")}
              </Button>
            </div>
          )}
          {data && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{data.task.title}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["local", "remote"] as const).map((side) => (
                  <div
                    key={side}
                    className="min-w-0 space-y-3 rounded-lg border border-border bg-background p-3"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {side === "local"
                        ? t("common:appName")
                        : t("settings:syncRules.repository")}
                    </p>
                    <p
                      className={
                        data.local.title !== data.remote.title
                          ? "break-words text-sm text-warning-foreground"
                          : "break-words text-sm"
                      }
                    >
                      {data[side].title}
                    </p>
                    <p className="text-xs">
                      {data[side].state === "closed"
                        ? t("settings:syncRules.closed")
                        : t("settings:syncRules.open")}
                    </p>
                    <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {data[side].description ||
                        t("settings:syncRules.noDescription")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogPanel>
        <DialogFooter className="flex-wrap">
          <DialogClose
            disabled={resume.isPending}
            render={<Button variant="ghost" size="sm" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !data ||
              preview.isFetching ||
              resume.isPending ||
              resume.isError ||
              preview.isError
            }
            onClick={() => choose("provider")}
          >
            {t("settings:syncRules.useRepository")}
          </Button>
          <Button
            size="sm"
            loading={resume.isPending}
            disabled={
              !data || preview.isFetching || resume.isError || preview.isError
            }
            onClick={() => choose("kaneo")}
          >
            {t("settings:syncRules.useKaneo")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
