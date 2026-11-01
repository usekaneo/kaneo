import { expect, it } from "vite-plus/test";
import { getModelLabel } from "./model-label";

it.each([
  ["openai/gpt-6-luna", "OpenAI: GPT-6 Luna"],
  ["openai/gpt-4.1-mini", "OpenAI: GPT-4.1 Mini"],
  ["anthropic/claude-opus-5", "Anthropic: Claude Opus 5"],
  ["x-ai/grok-5", "xAI: Grok 5"],
  ["meta-llama/llama-4-maverick:free", "Meta: Llama 4 Maverick (free)"],
  ["no-provider", "no-provider"],
  ["anthropic:claude-sonnet-5-5", "Anthropic: claude-sonnet-5-5"],
  ["openai:gpt-6-luna", "OpenAI: gpt-6-luna"],
  [
    "bedrock:us.anthropic.claude-v1:0",
    "Amazon Bedrock: us.anthropic.claude-v1:0",
  ],
  ["gateway:anthropic/claude-opus-5", "AI Gateway: Anthropic: Claude Opus 5"],
  ["openrouter:meta-llama/llama-4:free", "OpenRouter: Meta: Llama 4 (free)"],
])("labels %s as %s", (id, label) => {
  expect(getModelLabel(id)).toBe(label);
});
