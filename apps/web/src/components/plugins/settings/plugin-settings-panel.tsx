import { Separator } from "@/components/ui/separator";
import type { RuntimePlugin } from "@/lib/plugins/runtime/select-contributions";
import { PluginBoundary } from "../plugin-boundary";
import { PluginLoading } from "../plugin-loading";

type PluginSettingsPanelProps = {
  runtime: RuntimePlugin;
  workspaceId: string;
};

export function PluginSettingsPanel({
  runtime,
  workspaceId,
}: PluginSettingsPanelProps) {
  const { state, scope } = runtime;

  if (state.status === "loading") return <PluginLoading />;
  if (state.status === "failed" || !state.definition.settingsPanel) {
    return null;
  }

  const Panel = state.definition.settingsPanel;

  return (
    <>
      <Separator />
      <PluginBoundary scope={scope} resetKey={workspaceId}>
        <Panel workspaceId={workspaceId} />
      </PluginBoundary>
    </>
  );
}
