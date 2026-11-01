import { parseModelReference } from "./providers/model-reference";

const providers: Record<string, string> = {
  openai: "OpenAI",
  "x-ai": "xAI",
  "meta-llama": "Meta",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
  moonshotai: "Moonshot",
  openrouter: "OpenRouter",
  google: "Google",
  xai: "xAI",
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

function word(part: string) {
  if (acronyms.has(part)) return part.toUpperCase();
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function getModelLabel(id: string): string {
  const reference = parseModelReference(id);
  if (reference && reference.model !== id) {
    const label =
      reference.provider === "openrouter" || reference.provider === "gateway"
        ? getModelLabel(reference.model)
        : reference.model;
    return `${providers[reference.provider] ?? word(reference.provider)}: ${label}`;
  }
  const [provider = "", rest = ""] = id.split(/\/(.*)/s);
  if (!rest) return id;
  const [name = "", variant] = rest.split(":");
  const words: string[] = [];
  for (const part of name.split(/[-_]/).filter(Boolean)) {
    const previous = words.at(-1);
    if (previous && /^[A-Z]+$/.test(previous) && /^\d/.test(part))
      words[words.length - 1] = `${previous}-${part}`;
    else words.push(word(part));
  }
  const label = `${providers[provider] ?? word(provider)}: ${words.join(" ")}`;
  return variant ? `${label} (${variant})` : label;
}
