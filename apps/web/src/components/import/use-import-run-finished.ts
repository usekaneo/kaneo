import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getImportRunOutcome } from "@/components/import/get-import-run-progress";
import { getImportSource } from "@/components/import/import-source-definitions";
import type { ImportRun } from "@/fetchers/import/get-import-run";
import { toast } from "@/lib/toast";

export function useImportRunFinished(run: ImportRun | undefined) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const previousStatus = useRef(run?.status);

  useEffect(() => {
    if (!run) return;
    const wasRunning = previousStatus.current === "running";
    previousStatus.current = run.status;
    if (!wasRunning || run.status === "running") return;

    queryClient.invalidateQueries({ queryKey: ["projects", run.workspaceId] });
    queryClient.invalidateQueries({
      queryKey: ["import-runs", run.workspaceId],
    });

    const source = getImportSource(run.source).name;
    const outcome = getImportRunOutcome(run);
    if (outcome === "failed") {
      toast.error(t("settings:workspaceImport.toast.failed", { source }));
    } else if (outcome === "partial") {
      toast.warning(t("settings:workspaceImport.toast.partial", { source }));
    } else {
      toast.success(t("settings:workspaceImport.toast.finished", { source }));
    }
  }, [run, queryClient, t]);
}
