import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { getAgentConfig } from "./config";

beforeEach(() => {
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  for (const name of [
    "OPENROUTER_MODEL",
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
      maxSteps: 8,
      maxOutputTokens: 2048,
      timeoutMs: 120000,
      concurrency: 1,
    });
  });
  it("requires explicit enablement", () => {
    vi.stubEnv("KANEO_AGENT_ENABLED", "false");
    expect(getAgentConfig()).toBeNull();
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
  ])("fails closed for invalid %s", (name, value) => {
    vi.stubEnv(name, value);
    expect(getAgentConfig()).toBeNull();
  });
});
