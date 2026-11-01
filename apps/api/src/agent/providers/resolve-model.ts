import { pathToFileURL } from "node:url";
import { createProviderRegistry } from "ai";
import { builtinProviders } from "./builtins";
import { parseModelReference } from "./model-reference";
import { getProviderModule } from "./settings";
import type { AgentProvider, ProviderSettings } from "./types";

function isProvider(value: unknown): value is AgentProvider {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "languageModel" in value &&
    typeof value.languageModel === "function"
  );
}

async function loadCommunityRegistry() {
  const path = getProviderModule();
  if (!path) throw new Error("Agent provider is not configured");
  // Only the operator's absolute module path is imported, never request input.
  const module: { default?: unknown } = await import(pathToFileURL(path).href);
  const providers = module.default;
  if (!providers || typeof providers !== "object")
    throw new Error("Agent provider is not registered");
  return providers;
}

export async function listCommunityProviderNames() {
  const providers = await loadCommunityRegistry();
  return Object.keys(providers).filter(
    (id) =>
      /^[a-z][a-z0-9-]*$/.test(id) && isProvider(Reflect.get(providers, id)),
  );
}

export async function loadCommunityProvider(id: string) {
  const providers = await loadCommunityRegistry();
  if (!Object.hasOwn(providers, id))
    throw new Error("Agent provider is not registered");
  const provider: unknown = Reflect.get(providers, id);
  if (!isProvider(provider)) throw new Error("Invalid agent provider");
  return provider;
}

export async function resolveAgentModel(
  id: string,
  config: { models: string[]; providers: Record<string, ProviderSettings> },
) {
  // Recheck queued runs after configuration changes; never reroute old IDs.
  if (!config.models.includes(id))
    throw new Error("Agent model is unavailable");
  const reference = parseModelReference(id);
  if (!reference) throw new Error("Invalid agent model");
  const settings = config.providers[reference.provider];
  if (!settings) throw new Error("Agent provider is unavailable");
  const definition = Object.hasOwn(builtinProviders, reference.provider)
    ? builtinProviders[reference.provider]
    : undefined;
  const provider = definition
    ? await definition.load(settings)
    : await loadCommunityProvider(reference.provider);
  const registry = createProviderRegistry({ [reference.provider]: provider });
  return registry.languageModel(`${reference.provider}:${reference.model}`);
}
