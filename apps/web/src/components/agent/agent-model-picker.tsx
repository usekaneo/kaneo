import { useAgentModel } from "@/hooks/use-agent-model";
import { AgentModelMenu } from "./agent-model-menu";

export function AgentModelPicker({ workspaceId }: { workspaceId: string }) {
  const { models, model, setModel } = useAgentModel(workspaceId);
  if (models.length < 2) return null;
  return (
    <AgentModelMenu
      models={models}
      value={model ?? null}
      onValueChange={setModel}
    />
  );
}
