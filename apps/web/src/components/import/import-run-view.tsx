import { Link } from "@tanstack/react-router";
import { CircleAlert, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getImportRunOutcome,
  getImportRunProgress,
} from "@/components/import/get-import-run-progress";
import { ImportRunCard } from "@/components/import/import-run-card";
import { getImportSource } from "@/components/import/import-source-definitions";
import { ImportStepLayout } from "@/components/import/import-step-layout";
import { IMPORT_UNIT_COPY } from "@/components/import/import-unit-copy";
import { useImportRunFinished } from "@/components/import/use-import-run-finished";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import useImportRun from "@/hooks/queries/import/use-import-run";

type ImportRunViewProps = {
  workspaceId: string;
  runId: string;
  onOverview: () => void;
};

export function ImportRunView({
  workspaceId,
  runId,
  onOverview,
}: ImportRunViewProps) {
  const { t } = useTranslation();
  const {
    data: run,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useImportRun(workspaceId, runId);
  useImportRunFinished(run);

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlert />
            </EmptyMedia>
            <EmptyTitle>
              <h1>{t("settings:workspaceImport.run.loadError")}</h1>
            </EmptyTitle>
            <EmptyDescription>{error?.message}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button variant="outline" size="sm" onClick={onOverview}>
              {t("settings:workspaceImport.back.overview")}
            </Button>
            <Button size="sm" loading={isFetching} onClick={() => refetch()}>
              {t("settings:workspaceImport.retry")}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const source = getImportSource(run.source);
  const copy = IMPORT_UNIT_COPY[source.unit];
  const running = run.status === "running";
  const progress = getImportRunProgress(run.projects);
  const outcome = getImportRunOutcome(run);

  const title = running
    ? t("settings:workspaceImport.run.importingTitle", { source: source.name })
    : outcome === "failed"
      ? t("settings:workspaceImport.run.failedTitle")
      : t("settings:workspaceImport.run.finishedTitle");

  const summary =
    progress.completed === progress.total
      ? t(copy.allImported, { count: progress.total })
      : [
          t(copy.someImported, {
            count: progress.total,
            done: progress.completed,
          }),
          progress.failedNames.length > 0
            ? t("settings:workspaceImport.run.failedNames", {
                count: progress.failedNames.length,
                names: progress.failedNames,
              })
            : null,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <ImportStepLayout
      source={source}
      backLabel={t("settings:workspaceImport.back.overview")}
      onBack={onOverview}
      current={3}
      complete={!running}
      title={title}
      description={
        running ? t("settings:workspaceImport.run.leavePage") : summary
      }
    >
      <div className="space-y-3">
        <ImportRunCard run={run} source={source} progress={progress} />
        {running ? (
          <p className="flex items-center gap-2 text-muted-foreground text-xs">
            <Lock aria-hidden="true" className="size-3.5 shrink-0" />
            {t("settings:workspaceImport.run.keyInMemory", {
              source: source.name,
            })}
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {run.includeComments
                ? t("settings:workspaceImport.run.finishedNote")
                : t("settings:workspaceImport.run.finishedNoteNoComments")}
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onOverview}>
                {t("settings:workspaceImport.run.importMore")}
              </Button>
              <Button
                size="sm"
                render={
                  <Link
                    to="/dashboard/workspace/$workspaceId/projects"
                    params={{ workspaceId }}
                  />
                }
              >
                {t("settings:workspaceImport.run.goToProjects")}
              </Button>
            </div>
          </>
        )}
      </div>
    </ImportStepLayout>
  );
}
