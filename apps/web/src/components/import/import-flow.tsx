import { useNavigate } from "@tanstack/react-router";
import {
  getImportSource,
  type ImportSourceId,
} from "@/components/import/import-source-definitions";
import { ImportOverview } from "@/components/import/import-overview";
import { ImportRunView } from "@/components/import/import-run-view";
import { ImportSourceFlow } from "@/components/import/import-source-flow";
import { useFocusHeadingOnChange } from "@/components/import/use-focus-heading-on-change";

type ImportFlowProps = {
  source?: ImportSourceId;
  runId?: string;
  workspaceId: string;
  workspaceName: string;
};

export function ImportFlow({
  source,
  runId,
  workspaceId,
  workspaceName,
}: ImportFlowProps) {
  const navigate = useNavigate();
  const view = runId
    ? `run:${runId}`
    : source
      ? `source:${source}`
      : "overview";
  const containerRef = useFocusHeadingOnChange<HTMLDivElement>(view);

  const showOverview = () =>
    navigate({ to: "/dashboard/settings/workspace/import", search: {} });

  const showRun = (id: string) =>
    navigate({
      to: "/dashboard/settings/workspace/import",
      search: { run: id },
      replace: true,
    });

  return (
    <div ref={containerRef}>
      {runId ? (
        <ImportRunView
          key={runId}
          workspaceId={workspaceId}
          runId={runId}
          onOverview={showOverview}
        />
      ) : source ? (
        <ImportSourceFlow
          key={source}
          source={getImportSource(source)}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onCancel={showOverview}
          onStarted={showRun}
        />
      ) : (
        <ImportOverview
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      )}
    </div>
  );
}
