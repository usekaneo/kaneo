import { parseModelReference } from "./providers/model-reference";

const providerLabels: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  "x-ai": "xAI",
  "meta-llama": "Meta",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
  moonshotai: "Moonshot",
  openrouter: "OpenRouter",
  google: "Google",
  xai: "xAI",
  azure: "Azure OpenAI",
  bedrock: "Amazon Bedrock",
  "anthropic-aws": "Claude on AWS",
  vertex: "Google Vertex AI",
  "vertex-anthropic": "Claude on Vertex AI",
  "vertex-maas": "Vertex AI MaaS",
  "vertex-xai": "xAI on Vertex AI",
  togetherai: "Together.ai",
  huggingface: "Hugging Face",
  gmicloud: "GMI Cloud",
  zai: "Z.AI",
  gateway: "AI Gateway",
  compatible: "Custom endpoint",
  "open-responses": "Open Responses",
};
const acronyms = new Set(["gpt", "glm", "ai", "oss", "vl"]);
// Plain slugs like `claude-opus-5-5` or `gemini-2.5-pro`. Anything else, such
// as Bedrock's `us.anthropic.claude-v1:0`, is shown as-is.
const slug = /^[a-z][a-z0-9]*(?:[-_][a-z0-9.]+)*$/i;
const snapshot = /^(.*)-(\d{4}-\d{2}-\d{2}|\d{8})$/;

function word(part: string) {
  if (acronyms.has(part)) return part.toUpperCase();
  if (/^o\d/.test(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function getProviderLabel(provider: string) {
  return providerLabels[provider] ?? word(provider);
}

function humanize(model: string) {
  const [, name = model, date] = snapshot.exec(model) ?? [];
  const words: string[] = [];
  for (const part of name.split(/[-_]/).filter(Boolean)) {
    const previous = words.at(-1);
    if (previous && /^[A-Z]+$/.test(previous) && /^\d/.test(part))
      words[words.length - 1] = `${previous}-${part}`;
    // `claude-opus-5-5` is Claude Opus 5.5.
    else if (previous && /(^|[^\d.])\d$/.test(previous) && /^\d$/.test(part))
      words[words.length - 1] = `${previous}.${part}`;
    else words.push(word(part));
  }
  const label = words.join(" ");
  return date ? `${label} (${date})` : label;
}

export function getModelLabel(id: string): string {
  const reference = parseModelReference(id);
  if (reference && reference.model !== id) {
    const { provider, model } = reference;
    let label = model;
    if (provider === "openrouter" || provider === "gateway")
      label = getModelLabel(model);
    else if (slug.test(model)) label = humanize(model);
    return `${getProviderLabel(provider)}: ${label}`;
  }
  const [provider = "", rest = ""] = id.split(/\/(.*)/s);
  if (!rest) return id;
  const [name = "", variant] = rest.split(":");
  const label = `${getProviderLabel(provider)}: ${humanize(name)}`;
  return variant ? `${label} (${variant})` : label;
}
