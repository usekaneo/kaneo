export type ModelProvider = "anthropic" | "openai" | "google" | "other";

// OpenRouter model IDs start with the provider, e.g. `anthropic/claude-opus-5`.
export function getModelProvider(modelId: string): ModelProvider {
  const prefix = modelId
    .replace(/^(openrouter|gateway):/, "")
    .split(/[/:]/, 1)[0]
    ?.toLowerCase();
  return prefix === "anthropic" || prefix === "openai" || prefix === "google"
    ? prefix
    : "other";
}
