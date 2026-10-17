import { useState } from "react";
import { buildConnection } from "@/components/import/build-connection";
import {
  EMPTY_CONNECT_VALUES,
  type ImportConnectValues,
} from "@/components/import/connect-values";
import { ImportConnectStep } from "@/components/import/import-connect-step";
import {
  type ImportProjectSelection,
  ImportProjectPicker,
} from "@/components/import/import-project-picker";
import type { ImportSourceDefinition } from "@/components/import/import-source-definitions";
import { useFocusHeadingOnChange } from "@/components/import/use-focus-heading-on-change";
import { Spinner } from "@/components/ui/spinner";
import type { ImportSourceProject } from "@/fetchers/import/list-import-source-projects";
import useListImportSourceProjects from "@/hooks/mutations/import/use-list-import-source-projects";
import useStartImportRun from "@/hooks/mutations/import/use-start-import-run";
import useTrelloAuthorizeUrl from "@/hooks/queries/import/use-trello-authorize-url";

type ImportSourceFlowProps = {
  source: ImportSourceDefinition;
  workspaceId: string;
  workspaceName: string;
  onCancel: () => void;
  onStarted: (runId: string) => void;
};

export function ImportSourceFlow({
  source,
  workspaceId,
  workspaceName,
  onCancel,
  onStarted,
}: ImportSourceFlowProps) {
  const [values, setValues] =
    useState<ImportConnectValues>(EMPTY_CONNECT_VALUES);
  const [projects, setProjects] = useState<ImportSourceProject[] | null>(null);
  const listProjects = useListImportSourceProjects();
  const startRun = useStartImportRun();
  const isTrello = source.id === "trello";
  const trelloAuthorize = useTrelloAuthorizeUrl(workspaceId, isTrello);
  const trelloAuthorizeUrl = trelloAuthorize.data ?? null;
  const connection = buildConnection(source.id, values, {
    serverHasTrelloKey: trelloAuthorizeUrl !== null,
  });
  const isLoadingTrello = isTrello && trelloAuthorize.isLoading;
  const containerRef = useFocusHeadingOnChange<HTMLDivElement>(
    isLoadingTrello ? "loading" : projects ? "select" : "connect",
  );

  const updateValues = (patch: Partial<ImportConnectValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    if (listProjects.isError) listProjects.reset();
  };

  const connect = () => {
    if (!connection || listProjects.isPending) return;
    listProjects.mutate(
      { workspaceId, connection },
      {
        onSuccess: (data) => {
          listProjects.reset();
          setProjects(data.projects);
        },
      },
    );
  };

  const changeKey = () => {
    startRun.reset();
    setProjects(null);
  };

  const start = ({ projectIds, includeComments }: ImportProjectSelection) => {
    if (!connection || startRun.isPending) return;
    startRun.mutate(
      { workspaceId, connection, projectIds, includeComments },
      {
        onSuccess: ({ run }) => {
          setValues(EMPTY_CONNECT_VALUES);
          onStarted(run.id);
        },
      },
    );
  };

  return (
    <div ref={containerRef}>
      {isLoadingTrello ? (
        <div className="flex h-60 items-center justify-center">
          <Spinner />
        </div>
      ) : projects ? (
        <ImportProjectPicker
          source={source}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          projects={projects}
          error={startRun.error?.message ?? null}
          isStarting={startRun.isPending}
          onBack={changeKey}
          onStart={start}
        />
      ) : (
        <ImportConnectStep
          source={source}
          values={values}
          onChange={updateValues}
          trelloAuthorizeUrl={trelloAuthorizeUrl}
          error={listProjects.error?.message ?? null}
          canSubmit={connection !== null}
          isSubmitting={listProjects.isPending}
          onSubmit={connect}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
