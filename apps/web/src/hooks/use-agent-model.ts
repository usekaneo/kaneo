import useAgentConfig from "@/hooks/queries/agent/use-agent-config";
import { resolveAgentModel } from "@/lib/resolve-agent-model";
import { useAgentModelStore } from "@/store/agent-model";

export function useAgentModel(workspaceId: string) {
  const { data: config } = useAgentConfig(workspaceId);
  const stored = useAgentModelStore(
    (state) => state.modelByWorkspace[workspaceId],
  );
  const setModel = useAgentModelStore((state) => state.setModel);

  return {
    models: config?.models ?? [],
    model: resolveAgentModel(config, stored),
    setModel: (model: string) => setModel(workspaceId, model),
  };
}
