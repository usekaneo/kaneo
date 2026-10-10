import { usePlugins } from "@/lib/plugins/runtime/plugins-context";
import { selectContributions } from "@/lib/plugins/runtime/select-contributions";
import { usePluginLabel } from "@/lib/plugins/runtime/use-plugin-label";
import { PluginBoundary } from "./plugin-boundary";
import { PluginTaskPanelSection } from "./plugin-task-panel-section";

type PluginTaskPanelsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

export function PluginTaskPanels({
  taskId,
  projectId,
  workspaceId,
}: PluginTaskPanelsProps) {
  const { plugins } = usePlugins();
  const label = usePluginLabel();

  return selectContributions(plugins, "taskPanels").map(({ scope, item }) => (
    <div key={`${scope.id}:${item.id}`} className="mt-2">
      <PluginTaskPanelSection title={label(scope.id, item.title)}>
        <PluginBoundary scope={scope} resetKey={`${item.id}:${taskId}`}>
          <item.component
            workspaceId={workspaceId}
            projectId={projectId}
            taskId={taskId}
          />
        </PluginBoundary>
      </PluginTaskPanelSection>
    </div>
  ));
}
