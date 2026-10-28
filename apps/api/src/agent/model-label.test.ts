import { expect, it } from "vite-plus/test";
import { getModelLabel } from "./model-label";

it.each([
  ["openai/gpt-6-luna", "OpenAI: GPT-6 Luna"],
  ["openai/gpt-4.1-mini", "OpenAI: GPT-4.1 Mini"],
  ["anthropic/claude-opus-5", "Anthropic: Claude Opus 5"],
  ["x-ai/grok-5", "xAI: Grok 5"],
  ["meta-llama/llama-4-maverick:free", "Meta: Llama 4 Maverick (free)"],
  ["no-provider", "no-provider"],
])("labels %s as %s", (id, label) => {
  expect(getModelLabel(id)).toBe(label);
});
