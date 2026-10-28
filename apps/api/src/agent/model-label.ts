const providers: Record<string, string> = {
  openai: "OpenAI",
  "x-ai": "xAI",
  "meta-llama": "Meta",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
  moonshotai: "Moonshot",
  openrouter: "OpenRouter",
};
const acronyms = new Set(["gpt", "glm", "ai", "oss", "vl"]);

function word(part: string) {
  if (acronyms.has(part)) return part.toUpperCase();
  return part.charAt(0).toUpperCase() + part.slice(1);
}

// Readable label from an OpenRouter ID, e.g. "openai/gpt-6-luna" → "OpenAI: GPT-6 Luna".
export function getModelLabel(id: string) {
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
