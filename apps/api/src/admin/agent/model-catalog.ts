import { z } from "zod";
import { ApiError } from "../../errors/api-error";
import { getProviderSettings } from "../../agent/providers/settings";

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  display_name: z.string().optional(),
  displayName: z.string().optional(),
  supportedGenerationMethods: z.array(z.string()).optional(),
  supported_parameters: z.array(z.string()).optional(),
});
const responseSchema = z.object({
  data: z.array(itemSchema).optional(),
  models: z.array(itemSchema).optional(),
  has_more: z.boolean().optional(),
  last_id: z.string().nullish(),
  nextPageToken: z.string().optional(),
});
const endpoints: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
};

export async function listModelCatalog(provider: string) {
  try {
    const settings = getProviderSettings(provider);
    if (!settings) throw new Error("Unavailable provider");
    const baseURL = settings.baseURL ?? endpoints[provider];
    if (
      !baseURL ||
      (!Object.hasOwn(endpoints, provider) && provider !== "compatible")
    )
      return { supported: false, models: [] };
    const headers = new Headers();
    if (provider === "anthropic") {
      headers.set("x-api-key", settings.apiKey!);
      headers.set("anthropic-version", "2023-06-01");
    } else if (provider === "google")
      headers.set("x-goog-api-key", settings.apiKey!);
    else if (settings.apiKey)
      headers.set("Authorization", `Bearer ${settings.apiKey}`);
    const models = new Map<string, { id: string; label: string }>();
    const url = new URL(`${baseURL.replace(/\/$/, "")}/models`);
    if (provider === "anthropic") url.searchParams.set("limit", "100");
    if (provider === "google") url.searchParams.set("pageSize", "100");
    const signal = AbortSignal.timeout(15_000);
    for (let page = 0; page < 10; page++) {
      const response = await fetch(url, { headers, signal, redirect: "error" });
      if (!response.ok) throw new Error("Catalog request failed");
      const data = responseSchema.parse(await response.json());
      for (const item of data.data ?? data.models ?? []) {
        if (
          provider === "google" &&
          !item.supportedGenerationMethods?.includes("generateContent")
        )
          continue;
        if (
          provider === "openrouter" &&
          !item.supported_parameters?.includes("tools")
        )
          continue;
        const id = (item.id ?? item.name)?.replace(/^models\//, "");
        if (!id || /[\s,]/.test(id) || `${provider}:${id}`.length > 200)
          continue;
        const qualified = `${provider}:${id}`;
        models.set(qualified, {
          id: qualified,
          label: item.display_name ?? item.displayName ?? item.name ?? id,
        });
      }
      if (data.has_more && data.last_id)
        url.searchParams.set("after_id", data.last_id);
      else if (data.nextPageToken)
        url.searchParams.set("pageToken", data.nextPageToken);
      else
        return {
          supported: true,
          models: [...models.values()].sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        };
    }
    throw new Error("Catalog exceeded pagination limit");
  } catch {
    // Upstream errors can include credentials, requests, or private endpoints.
    throw new ApiError(502, {
      code: "AGENT_CATALOG_UNAVAILABLE",
      message:
        "Could not load this provider's models. Retry or enter a model ID.",
    });
  }
}
