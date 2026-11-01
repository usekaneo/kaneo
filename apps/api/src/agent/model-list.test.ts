import { describe, expect, it } from "vite-plus/test";
import { MAX_AGENT_MODELS, parseAgentModels } from "./model-list";

describe("parseAgentModels", () => {
  it("is just the default when no list is set", () => {
    expect(parseAgentModels("openai/gpt-6-luna")).toEqual([
      "openai/gpt-6-luna",
    ]);
    expect(parseAgentModels("openai/gpt-6-luna", " , ")).toEqual([
      "openai/gpt-6-luna",
    ]);
  });
  it("trims, dedupes, and prepends a missing default", () => {
    expect(
      parseAgentModels(
        "openai/gpt-6-luna",
        " anthropic/claude-opus-5 ,google/gemini-3-pro,anthropic/claude-opus-5,",
      ),
    ).toEqual([
      "openai/gpt-6-luna",
      "anthropic/claude-opus-5",
      "google/gemini-3-pro",
    ]);
  });
  it("keeps the listed position of the default", () => {
    expect(
      parseAgentModels(
        "openai/gpt-6-luna",
        "anthropic/claude-opus-5,openai/gpt-6-luna",
      ),
    ).toEqual(["anthropic/claude-opus-5", "openai/gpt-6-luna"]);
  });
  it("rejects malformed IDs and oversized lists", () => {
    expect(parseAgentModels("a/b", "c/d e")).toBeNull();
    expect(parseAgentModels("a/b", "x".repeat(201))).toBeNull();
    const many = Array.from(
      { length: MAX_AGENT_MODELS },
      (_, index) => `p/m${index}`,
    );
    expect(parseAgentModels("a/b", many.join(","))).toBeNull();
    expect(parseAgentModels("p/m0", many.join(","))).toHaveLength(
      MAX_AGENT_MODELS,
    );
  });
});
