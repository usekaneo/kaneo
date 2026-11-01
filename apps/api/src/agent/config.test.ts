import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { getAgentConfig } from "./config";

vi.mock("dotenv-mono", () => ({ config: () => {} }));

beforeEach(() => {
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  for (const name of [
    "OPENROUTER_MODEL",
    "OPENROUTER_MODELS",
    "KANEO_AGENT_MODEL",
    "KANEO_AGENT_MODELS",
    "KANEO_AGENT_PROVIDERS_MODULE",
    "OPENROUTER_BASE_URL",
    "KANEO_AGENT_MAX_STEPS",
    "KANEO_AGENT_MAX_OUTPUT_TOKENS",
    "KANEO_AGENT_TIMEOUT_MS",
    "KANEO_AGENT_CONCURRENCY",
  ])
    delete process.env[name];
});
afterEach(() => vi.unstubAllEnvs());

describe("agent configuration", () => {
  it("defaults to a bounded Luna run", () => {
    expect(getAgentConfig()).toMatchObject({
      model: "openai/gpt-6-luna",
      models: ["openai/gpt-6-luna"],
      maxSteps: 8,
      maxOutputTokens: 2048,
      timeoutMs: 120000,
      concurrency: 1,
    });
  });
  it("allows listed models alongside the default", () => {
    vi.stubEnv("OPENROUTER_MODELS", "anthropic/claude-opus-5");
    expect(getAgentConfig()?.models).toEqual([
      "openai/gpt-6-luna",
      "anthropic/claude-opus-5",
    ]);
  });
  it("requires explicit enablement", () => {
    vi.stubEnv("KANEO_AGENT_ENABLED", "false");
    expect(getAgentConfig()).toBeNull();
  });
  it("uses direct Anthropic without an OpenRouter key", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("KANEO_AGENT_MODEL", "anthropic:claude-sonnet-5-5");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-test");
    expect(getAgentConfig()).toMatchObject({
      model: "anthropic:claude-sonnet-5-5",
      models: ["anthropic:claude-sonnet-5-5"],
      providers: { anthropic: { apiKey: "anthropic-test" } },
    });
  });
  it("supports a mixed provider allowlist and fails closed for missing credentials", () => {
    vi.stubEnv("KANEO_AGENT_MODEL", "anthropic:claude-sonnet-5-5");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-test");
    vi.stubEnv("OPENAI_API_KEY", "openai-test");
    vi.stubEnv("KANEO_AGENT_MODELS", "openai:gpt-6-luna,openai/gpt-6-luna");
    expect(getAgentConfig()?.models).toEqual([
      "anthropic:claude-sonnet-5-5",
      "openai:gpt-6-luna",
      "openai/gpt-6-luna",
    ]);
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY_FILE", "");
    expect(getAgentConfig()).toBeNull();
  });
  it("does not fall back when the new model configuration is invalid", () => {
    vi.stubEnv("KANEO_AGENT_MODEL", "");
    expect(getAgentConfig()).toBeNull();
    vi.stubEnv("KANEO_AGENT_MODEL", "anthropic:");
    expect(getAgentConfig()).toBeNull();
    vi.stubEnv("KANEO_AGENT_MODEL", "unknown:some-model");
    expect(getAgentConfig()).toBeNull();
  });
  it("keeps legacy variant IDs on OpenRouter", () => {
    vi.stubEnv("OPENROUTER_MODEL", "meta-llama/llama-4:free");
    expect(getAgentConfig()?.providers).toHaveProperty("openrouter");
  });
  it("fails closed for unreadable file secrets", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY_FILE", "/nonexistent/agent-test-key");
    expect(getAgentConfig()).toBeNull();
  });
  it.each([
    ["KANEO_AGENT_MAX_STEPS", "100"],
    ["KANEO_AGENT_MAX_STEPS", "NaN"],
    ["KANEO_AGENT_MAX_OUTPUT_TOKENS", "1000000"],
    ["KANEO_AGENT_TIMEOUT_MS", "0"],
    ["KANEO_AGENT_CONCURRENCY", "10"],
    ["OPENROUTER_MODEL", ""],
    ["OPENROUTER_MODELS", "openai/gpt-6-luna, bad model"],
  ])("fails closed for invalid %s", (name, value) => {
    vi.stubEnv(name, value);
    expect(getAgentConfig()).toBeNull();
  });
});
