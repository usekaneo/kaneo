import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { resolveFileSecret } from "../../utils/file-secret";
import { builtinProviders } from "./builtins";
import type { ProviderSettings } from "./types";

export function getProviderModule() {
  const path = process.env.KANEO_AGENT_PROVIDERS_MODULE;
  if (!path || !isAbsolute(path) || !statSync(path).isFile()) return null;
  return path;
}

export function getProviderSettings(provider: string): ProviderSettings | null {
  const definition = Object.hasOwn(builtinProviders, provider)
    ? builtinProviders[provider]
    : undefined;
  if (!definition) return getProviderModule() ? {} : null;
  const apiKey = definition.apiKeyEnv
    ? resolveFileSecret(definition.apiKeyEnv)
    : undefined;
  const baseURL =
    process.env[`${provider.replaceAll("-", "_").toUpperCase()}_BASE_URL`];
  if (baseURL) {
    const url = new URL(baseURL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
  }
  const settings: ProviderSettings = { apiKey, baseURL };
  if (provider === "gateway" && process.env.VERCEL_OIDC_TOKEN) return settings;
  if (provider === "compatible" || provider === "open-responses")
    return baseURL ? settings : null;
  if (provider === "bedrock" || provider === "anthropic-aws") {
    settings.region = process.env.AWS_REGION;
    settings.accessKeyId = resolveFileSecret("AWS_ACCESS_KEY_ID");
    settings.secretAccessKey = resolveFileSecret("AWS_SECRET_ACCESS_KEY");
    settings.sessionToken = resolveFileSecret("AWS_SESSION_TOKEN");
    if (
      !settings.region ||
      (!apiKey && !(settings.accessKeyId && settings.secretAccessKey))
    )
      return null;
    if (provider === "anthropic-aws") {
      settings.workspaceId = process.env.ANTHROPIC_AWS_WORKSPACE_ID;
      if (!settings.workspaceId) return null;
    }
    return settings;
  }
  if (provider.startsWith("vertex")) {
    settings.project = process.env.GOOGLE_VERTEX_PROJECT;
    settings.location = process.env.GOOGLE_VERTEX_LOCATION;
    // Vertex's SDK resolves Application Default Credentials at request time.
    return (provider === "vertex" && apiKey) ||
      (settings.project && settings.location)
      ? settings
      : null;
  }
  if (provider === "azure") {
    settings.resourceName = process.env.AZURE_RESOURCE_NAME;
    if (!settings.resourceName && !baseURL) return null;
  }
  return apiKey ? settings : null;
}
