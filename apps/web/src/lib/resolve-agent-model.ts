type AgentModelConfig = {
  model: string | null;
  models: Array<{ id: string }>;
};

// A stored choice only counts while the instance still allows it.
export function resolveAgentModel(
  config: AgentModelConfig | undefined,
  stored: string | undefined,
) {
  if (stored && config?.models.some((item) => item.id === stored))
    return stored;
  return config?.model ?? undefined;
}
