import { describe, expect, it } from "vite-plus/test";
import { getModelProvider } from "./get-model-provider";

describe("getModelProvider", () => {
  it.each([
    ["anthropic/claude-opus-5", "anthropic"],
    ["anthropic:claude-sonnet-5-5", "anthropic"],
    ["openai:gpt-6-luna", "openai"],
    ["openrouter:google/gemini-3-pro", "google"],
    ["openai/gpt-6-luna", "openai"],
    ["google/gemini-3-pro", "google"],
    ["OpenAI/gpt-6", "openai"],
    ["meta-llama/llama-4", "other"],
    ["anthropic", "anthropic"],
    ["openai-compatible/model", "other"],
    ["", "other"],
  ])("maps %s to %s", (id, provider) => {
    expect(getModelProvider(id)).toBe(provider);
  });
});
