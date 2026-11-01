import { getAgentConfig } from "../../agent/config";
import { getModelLabel, getProviderLabel } from "../../agent/model-label";
import { parseAgentModels } from "../../agent/model-list";
import { builtinProviders } from "../../agent/providers/builtins";
import { parseModelReference } from "../../agent/providers/model-reference";
import { getProviderSettings } from "../../agent/providers/settings";
import { listCommunityProviderNames } from "../../agent/providers/resolve-model";
import { readStoredSettings } from "../../instance-settings/read-stored-settings";

export async function readAgentSettings() {
  const { agentModels: policy } = await readStoredSettings();
  const model =
    policy?.model ??
    process.env.KANEO_AGENT_MODEL ??
    process.env.OPENROUTER_MODEL ??
    "openai/gpt-6-luna";
  const models =
    policy?.models ??
    parseAgentModels(
      model,
      process.env.KANEO_AGENT_MODELS ?? process.env.OPENROUTER_MODELS,
    ) ??
    [];
  const names = new Set([
    ...Object.keys(builtinProviders),
    ...models.flatMap((id) => {
      const reference = parseModelReference(id);
      return reference ? [reference.provider] : [];
    }),
  ]);
  try {
    for (const name of await listCommunityProviderNames()) names.add(name);
  } catch {
    // Missing or invalid custom modules do not hide the built-in providers.
  }
  const providers = [...names]
    .filter((id) => {
      try {
        return Boolean(getProviderSettings(id));
      } catch {
        return false;
      }
    })
    .map((id) => ({ id, label: getProviderLabel(id) }));
  // Provider names are public; settings and credentials are never returned.
  return {
    enabled: Boolean(getAgentConfig(policy)),
    managed: Boolean(policy),
    model: models.includes(model) ? model : null,
    models: models.map((id) => ({ id, label: getModelLabel(id) })),
    providers,
  };
}
