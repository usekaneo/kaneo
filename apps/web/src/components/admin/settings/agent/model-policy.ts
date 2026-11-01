import type { AdminAgentSettings } from "./types";

type Policy = { model: string; models: string[] };

function current(settings: AdminAgentSettings) {
  const models = settings.models.map((item) => item.id);
  const model =
    settings.model && models.includes(settings.model) ? settings.model : "";
  return { model, models };
}

export function addModel(settings: AdminAgentSettings, id: string): Policy {
  const { model, models } = current(settings);
  // An environment default may belong to a provider without credentials.
  // Keeping it would prevent saving the first usable model policy.
  const available = models.filter((modelId) => {
    const provider = /^([a-z][a-z0-9-]*):/.exec(modelId)?.[1] ?? "openrouter";
    return settings.providers.some((item) => item.id === provider);
  });
  return {
    model: available.includes(model) ? model : id,
    models: [...available, id],
  };
}

export function removeModel(
  settings: AdminAgentSettings,
  id: string,
): Policy | null {
  const { model, models } = current(settings);
  const remaining = models.filter((item) => item !== id);
  if (!remaining.length) return null;
  return {
    model: remaining.includes(model) ? model : remaining[0]!,
    models: remaining,
  };
}

export function makeDefault(settings: AdminAgentSettings, id: string): Policy {
  return { model: id, models: current(settings).models };
}
