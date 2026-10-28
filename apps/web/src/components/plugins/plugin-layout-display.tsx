import type { ProjectViewState } from "@kaneo/plugin-sdk/web";
import { DisplaySection } from "@/components/project/display/display-section";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import { PluginProjectViewContext } from "@/lib/plugins/host/plugin-project-view-context";
import type { PluginLayoutId } from "@/lib/plugins/plugin-layout-id";
import type { Contribution } from "@/lib/plugins/runtime/select-contributions";
import { PluginBoundary } from "./plugin-boundary";

type PluginLayoutDisplayProps = {
  workspaceId: string;
  projectId: string;
  layoutId: PluginLayoutId;
  contribution: Contribution<"projectViews"> | null;
  state: ProjectViewState;
};

export function PluginLayoutDisplay({
  workspaceId,
  projectId,
  layoutId,
  contribution,
  state,
}: PluginLayoutDisplayProps) {
  const Display = contribution?.item.display;

  return (
    <>
      <DisplaySection>
        <LayoutSwitch
          workspaceId={workspaceId}
          projectId={projectId}
          currentRoute={layoutId}
          currentView={layoutId}
        />
      </DisplaySection>
      {contribution && Display && (
        <DisplaySection>
          <PluginBoundary
            scope={contribution.scope}
            resetKey={`${workspaceId}:${projectId}:${contribution.item.id}:display`}
          >
            <PluginProjectViewContext.Provider value={state}>
              <Display workspaceId={workspaceId} projectId={projectId} />
            </PluginProjectViewContext.Provider>
          </PluginBoundary>
        </DisplaySection>
      )}
    </>
  );
}
