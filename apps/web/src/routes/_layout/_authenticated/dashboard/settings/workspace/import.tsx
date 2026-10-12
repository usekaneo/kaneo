import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ImportFlow } from "@/components/import/import-flow";
import { ImportNotAllowed } from "@/components/import/import-not-allowed";
import {
  type ImportSourceId,
  isImportSourceId,
} from "@/components/import/import-source-definitions";
import PageTitle from "@/components/page-title";
import { Spinner } from "@/components/ui/spinner";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useCanImport } from "@/hooks/use-can-import";

type ImportSearch = {
  source?: ImportSourceId;
  run?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/import",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): ImportSearch => ({
    source: isImportSourceId(search.source) ? search.source : undefined,
    run:
      typeof search.run === "string" && search.run.length > 0
        ? search.run
        : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { source, run } = Route.useSearch();
  const { data: workspace } = useActiveWorkspace();
  const { canImport, isCheckingPermissions } = useCanImport();

  return (
    <>
      <PageTitle title={t("settings:workspaceImport.pageTitle")} />
      {!workspace || isCheckingPermissions ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : canImport ? (
        <ImportFlow
          source={source}
          runId={run}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
        />
      ) : (
        <ImportNotAllowed />
      )}
    </>
  );
}
