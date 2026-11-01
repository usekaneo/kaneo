import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, expect, it, vi } from "vite-plus/test";
import { builtinProviders } from "./builtins";
import { resolveAgentModel } from "./resolve-model";
import { parseModelReference } from "./model-reference";

afterEach(() => vi.unstubAllEnvs());
const directory = mkdtempSync(join(tmpdir(), "kaneo-provider-module-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

it.each(Object.keys(builtinProviders))(
  "resolves the installed %s adapter without a network request",
  async (provider) => {
    const id = `${provider}:test-model`;
    const model = await resolveAgentModel(id, {
      models: [id],
      providers: {
        [provider]: {
          apiKey: "adapter-test-key",
          baseURL: "https://provider.invalid/v1",
          region: "us-east-1",
          project: "test-project",
          location: "us-central1",
          workspaceId: "test-workspace",
          resourceName: "test-resource",
        },
      },
    });
    expect(model.modelId).toBe("test-model");
    expect(typeof model.doStream).toBe("function");
  },
);

it("rejects unlisted models before loading a provider", async () => {
  await expect(
    resolveAgentModel("anthropic:unlisted", {
      models: ["openai/gpt-6-luna"],
      providers: {},
    }),
  ).rejects.toThrow("unavailable");
});

it("loads an SDK-compatible community provider from the operator's module", async () => {
  const path = join(directory, "providers.mjs");
  writeFileSync(
    path,
    `export default {
    local: {
      specificationVersion: 'v4',
      languageModel: (modelId) => ({ specificationVersion: 'v4', modelId, provider: 'local',
        supportedUrls: {}, doStream() {}, doGenerate() {} })
    }
  };`,
  );
  vi.stubEnv("KANEO_AGENT_PROVIDERS_MODULE", path);
  const model = await resolveAgentModel("local:my-model", {
    models: ["local:my-model"],
    providers: { local: {} },
  });
  expect(model.modelId).toBe("my-model");
  expect(model.provider).toBe("local");
  await expect(
    resolveAgentModel("missing:model", {
      models: ["missing:model"],
      providers: { missing: {} },
    }),
  ).rejects.toThrow("not registered");
});

it.each([
  [
    "meta-llama/llama-4:free",
    { provider: "openrouter", model: "meta-llama/llama-4:free" },
  ],
  [
    "bedrock:us.anthropic.claude-v1:0",
    { provider: "bedrock", model: "us.anthropic.claude-v1:0" },
  ],
  [
    "openrouter:meta-llama/llama-4:free",
    { provider: "openrouter", model: "meta-llama/llama-4:free" },
  ],
  ["anthropic:", null],
  ["bad model", null],
])("preserves model identity for %s", (id, reference) => {
  expect(parseModelReference(id as string)).toEqual(reference);
});
