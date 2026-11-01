import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, expect, it, vi } from "vite-plus/test";
import { getProviderSettings } from "./settings";

const directory = mkdtempSync(join(tmpdir(), "kaneo-provider-settings-"));
afterEach(() => vi.unstubAllEnvs());
afterAll(() => rmSync(directory, { recursive: true, force: true }));

it("loads direct provider keys from files without putting them in process.env", () => {
  const path = join(directory, "anthropic-key");
  writeFileSync(path, "file-test-key\n");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY_FILE", path);
  expect(getProviderSettings("anthropic")?.apiKey).toBe("file-test-key");
  expect(process.env.ANTHROPIC_API_KEY).toBe("");
});

it("permits unauthenticated local endpoints only with an explicit URL", () => {
  vi.stubEnv("COMPATIBLE_API_KEY", "");
  vi.stubEnv("COMPATIBLE_BASE_URL", "http://127.0.0.1:11434/v1");
  expect(getProviderSettings("compatible")?.baseURL).toBe(
    "http://127.0.0.1:11434/v1",
  );
  vi.stubEnv("COMPATIBLE_BASE_URL", "");
  expect(getProviderSettings("compatible")).toBeNull();
  vi.stubEnv("COMPATIBLE_BASE_URL", "file:///etc/passwd");
  expect(getProviderSettings("compatible")).toBeNull();
  vi.stubEnv("COMPATIBLE_BASE_URL", "https://user:password@example.com/v1");
  expect(getProviderSettings("compatible")).toBeNull();
});

it("validates cloud region/resource settings and accepts Vertex ADC configuration", () => {
  vi.stubEnv("AWS_REGION", "us-east-1");
  vi.stubEnv("AWS_BEARER_TOKEN_BEDROCK", "bedrock-test");
  expect(getProviderSettings("bedrock")).toMatchObject({
    region: "us-east-1",
    apiKey: "bedrock-test",
  });
  vi.stubEnv("AWS_REGION", "");
  expect(getProviderSettings("bedrock")).toBeNull();
  vi.stubEnv("AZURE_API_KEY", "azure-test");
  vi.stubEnv("AZURE_RESOURCE_NAME", "");
  vi.stubEnv("AZURE_BASE_URL", "");
  expect(getProviderSettings("azure")).toBeNull();
  vi.stubEnv("AZURE_RESOURCE_NAME", "kaneo-test");
  expect(getProviderSettings("azure")?.resourceName).toBe("kaneo-test");
  vi.stubEnv("GOOGLE_VERTEX_PROJECT", "local-project");
  vi.stubEnv("GOOGLE_VERTEX_LOCATION", "us-central1");
  expect(getProviderSettings("vertex-anthropic")).toMatchObject({
    project: "local-project",
    location: "us-central1",
  });
});

it("requires a real absolute module path for community adapters", () => {
  vi.stubEnv("KANEO_AGENT_PROVIDERS_MODULE", "");
  expect(getProviderSettings("constructor")).toBeNull();
  vi.stubEnv("KANEO_AGENT_PROVIDERS_MODULE", "relative.mjs");
  expect(getProviderSettings("ollama")).toBeNull();
  const path = join(directory, "providers.mjs");
  writeFileSync(path, "export default {};");
  vi.stubEnv("KANEO_AGENT_PROVIDERS_MODULE", path);
  expect(getProviderSettings("ollama")).toEqual({});
});
