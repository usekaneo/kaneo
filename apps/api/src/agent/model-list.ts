export const MAX_AGENT_MODELS = 20;

const modelId = /^[^\s,]{1,200}$/;

// The default is always allowed; listing it in OPENROUTER_MODELS sets its position.
export function parseAgentModels(defaultModel: string, raw?: string) {
  const listed = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!listed.every((item) => modelId.test(item))) return null;
  const models = [...new Set(listed)];
  if (!models.includes(defaultModel)) models.unshift(defaultModel);
  return models.length > MAX_AGENT_MODELS ? null : models;
}
