import { generateKeyPairSync } from "node:crypto";
import { afterEach, expect, it, vi } from "vite-plus/test";
vi.mock("dotenv-mono", () => ({ config: () => {} }));
import { codeJobsEnabled, getCodeJobsConfig } from "./config";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
afterEach(() => vi.unstubAllEnvs());
function configured() {
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "test");
  vi.stubEnv("KANEO_AGENT_GITHUB_APP_ID", "123");
  vi.stubEnv("KANEO_API_URL", "https://kaneo.example");
  vi.stubEnv("KANEO_AGENT_GITHUB_APP_PRIVATE_KEY", key);
  vi.stubEnv("KANEO_AGENT_GITHUB_APP_PRIVATE_KEY_BASE64", "");
  vi.stubEnv("KANEO_AGENT_GITHUB_APP_PRIVATE_KEY_FILE", "");
}
it("requires a separate valid App configuration without disabling the assistant", () => {
  configured();
  expect(codeJobsEnabled()).toBe(true);
  expect(getCodeJobsConfig()?.jobTimeoutMinutes).toBe(30);
  vi.stubEnv("KANEO_AGENT_GITHUB_APP_PRIVATE_KEY", "invalid");
  expect(codeJobsEnabled()).toBe(false);
});
it("accepts file/base64 key shapes and rejects invalid bounded settings", () => {
  configured();
  vi.stubEnv(
    "KANEO_AGENT_GITHUB_APP_PRIVATE_KEY_BASE64",
    Buffer.from(key).toString("base64"),
  );
  expect(getCodeJobsConfig()?.privateKey).toBe(key);
  vi.stubEnv("KANEO_CODE_JOB_TIMEOUT_MINUTES", "999");
  expect(getCodeJobsConfig()).toBeNull();
});
