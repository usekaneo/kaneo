import { describe, expect, it } from "vite-plus/test";
import { resolveAgentModel } from "./resolve-agent-model";

const config = {
  model: "openai/gpt-6-luna",
  models: [{ id: "openai/gpt-6-luna" }, { id: "anthropic/claude-opus-5" }],
};

describe("resolveAgentModel", () => {
  it("uses an allowed stored choice", () => {
    expect(resolveAgentModel(config, "anthropic/claude-opus-5")).toBe(
      "anthropic/claude-opus-5",
    );
  });
  it("falls back to the default when the stored model is no longer allowed", () => {
    expect(resolveAgentModel(config, "google/gemini-3-pro")).toBe(
      "openai/gpt-6-luna",
    );
    expect(resolveAgentModel(config, undefined)).toBe("openai/gpt-6-luna");
  });
  it("is undefined before the config loads or when disabled", () => {
    expect(resolveAgentModel(undefined, "openai/gpt-6-luna")).toBeUndefined();
    expect(resolveAgentModel({ model: null, models: [] }, undefined)).toBe(
      undefined,
    );
  });
});
