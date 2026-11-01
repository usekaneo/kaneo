import { expect, it } from "vite-plus/test";
import { getModelLabel } from "./model-label";

it.each([
  ["openai/gpt-6-luna", "OpenAI: GPT-6 Luna"],
  ["openai/gpt-4.1-mini", "OpenAI: GPT-4.1 Mini"],
  ["anthropic/claude-opus-5", "Anthropic: Claude Opus 5"],
  ["x-ai/grok-5", "xAI: Grok 5"],
  ["meta-llama/llama-4-maverick:free", "Meta: Llama 4 Maverick (free)"],
  ["no-provider", "no-provider"],
  ["anthropic:claude-sonnet-5-5", "Anthropic: Claude Sonnet 5.5"],
  [
    "anthropic:claude-haiku-4-5-20251001",
    "Anthropic: Claude Haiku 4.5 (20251001)",
  ],
  ["openai:gpt-6-luna", "OpenAI: GPT-6 Luna"],
  ["openai:gpt-5-5-mini", "OpenAI: GPT-5.5 Mini"],
  ["openai:o4-mini-2025-04-16", "OpenAI: o4 Mini (2025-04-16)"],
  ["google:gemini-2.5-pro", "Google: Gemini 2.5 Pro"],
  ["compatible:qwen2-5-72b-instruct", "Custom endpoint: Qwen2.5 72b Instruct"],
  [
    "bedrock:us.anthropic.claude-v1:0",
    "Amazon Bedrock: us.anthropic.claude-v1:0",
  ],
  ["gateway:anthropic/claude-opus-5", "AI Gateway: Anthropic: Claude Opus 5"],
  ["openrouter:meta-llama/llama-4:free", "OpenRouter: Meta: Llama 4 (free)"],
])("labels %s as %s", (id, label) => {
  expect(getModelLabel(id)).toBe(label);
});
