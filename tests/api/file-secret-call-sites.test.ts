import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  creemApiKey,
  creemWebhookSecret,
} from "../../apps/api/src/billing/config";
import {
  decryptSecret,
  encryptSecret,
} from "../../apps/api/src/notification-preferences/secrets";
import {
  getGithubApp,
  resolveGithubPrivateKey,
} from "../../apps/api/src/plugins/github/utils/github-app";
import { assertStorageConfigured } from "../../apps/api/src/storage/s3";
import getSettings from "../../apps/api/src/utils/get-settings";
import { getGithubSsoOAuthCredentials } from "../../apps/api/src/utils/github-sso-env";
import { verifyTurnstile } from "../../apps/api/src/utils/verify-turnstile";

const secretNames = [
  "GITHUB_PRIVATE_KEY",
  "GITHUB_PRIVATE_KEY_BASE64",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_CLIENT_SECRET",
  "TURNSTILE_SECRET_KEY",
  "NOTIFICATION_SECRET_ENCRYPTION_KEY",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "CREEM_API_KEY",
  "CREEM_WEBHOOK_SECRET",
];
const keys = [
  ...secretNames,
  ...secretNames.map((name) => `${name}_FILE`),
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_CLIENT_ID",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "GITHUB_APP_ID",
  "KANEO_CLOUD",
];

describe("secrets read from _FILE variables", () => {
  const original: Record<string, string | undefined> = {};
  let directory: string;

  function secretFile(name: string, value: string) {
    const file = path.join(directory, name);
    writeFileSync(file, `${value}\n`);
    process.env[`${name}_FILE`] = file;
  }

  function missingSecretFile(name: string) {
    const file = path.join(directory, `missing-${name}`);
    process.env[`${name}_FILE`] = file;
    return file;
  }

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "kaneo-file-secret-sites-"));
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it("reads the GitHub App private key from a file", () => {
    secretFile(
      "GITHUB_PRIVATE_KEY",
      "-----BEGIN KEY-----\nabc\n-----END KEY-----",
    );
    expect(resolveGithubPrivateKey()).toBe(
      "-----BEGIN KEY-----\nabc\n-----END KEY-----",
    );
  });

  it("reads the base64 GitHub App private key from a file", () => {
    secretFile(
      "GITHUB_PRIVATE_KEY_BASE64",
      Buffer.from("pem").toString("base64"),
    );
    expect(resolveGithubPrivateKey()).toBe("pem");
  });

  it("reads GitHub sign-in client secrets from files", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "oauth-id";
    secretFile("GITHUB_OAUTH_CLIENT_SECRET", "oauth-secret");
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "oauth-id",
      clientSecret: "oauth-secret",
    });

    delete process.env.GITHUB_OAUTH_CLIENT_ID;
    process.env.GITHUB_CLIENT_ID = "legacy-id";
    secretFile("GITHUB_CLIENT_SECRET", "legacy-secret");
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "legacy-id",
      clientSecret: "legacy-secret",
    });
  });

  it("enforces Turnstile when its secret comes from a file", async () => {
    expect(await verifyTurnstile(undefined)).toEqual({ ok: true });
    secretFile("TURNSTILE_SECRET_KEY", "turnstile-secret");
    expect(await verifyTurnstile(undefined)).toEqual({
      ok: false,
      reason: "Captcha verification failed.",
    });
  });

  it("encrypts notification secrets with a key from a file", () => {
    secretFile("NOTIFICATION_SECRET_ENCRYPTION_KEY", "encryption-key");
    const encrypted = encryptSecret("webhook-token");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptSecret(encrypted)).toBe("webhook-token");
  });

  it("reads S3 access keys from files", () => {
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_BUCKET = "kaneo";
    secretFile("S3_ACCESS_KEY_ID", "access-key");
    secretFile("S3_SECRET_ACCESS_KEY", "secret-key");
    const config = assertStorageConfigured();
    expect(config.accessKeyId).toBe("access-key");
    expect(config.secretAccessKey).toBe("secret-key");
  });

  it("reads Creem billing secrets from files", () => {
    secretFile("CREEM_API_KEY", "creem-key");
    secretFile("CREEM_WEBHOOK_SECRET", "creem-webhook");
    expect(creemApiKey()).toBe("creem-key");
    expect(creemWebhookSecret()).toBe("creem-webhook");
  });

  it("skips GitHub App secret files when the app is not configured", () => {
    missingSecretFile("GITHUB_PRIVATE_KEY");
    missingSecretFile("GITHUB_WEBHOOK_SECRET");
    expect(getGithubApp()).toBeNull();
  });

  it("skips a GitHub sign-in secret file whose client ID is unset", () => {
    missingSecretFile("GITHUB_OAUTH_CLIENT_SECRET");
    process.env.GITHUB_CLIENT_ID = "legacy-id";
    secretFile("GITHUB_CLIENT_SECRET", "legacy-secret");
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "legacy-id",
      clientSecret: "legacy-secret",
    });

    delete process.env.GITHUB_CLIENT_ID;
    missingSecretFile("GITHUB_CLIENT_SECRET");
    expect(getGithubSsoOAuthCredentials()).toEqual({
      clientId: "",
      clientSecret: "",
    });
  });

  it("keeps settings available when a billing secret file is broken", () => {
    process.env.KANEO_CLOUD = "true";
    missingSecretFile("CREEM_API_KEY");
    expect(getSettings().billingEnabled).toBe(false);
    expect(() => creemApiKey()).toThrow("CREEM_API_KEY_FILE could not be read");
  });

  it("keeps S3 secret file paths out of upload errors", () => {
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_BUCKET = "kaneo";
    const file = missingSecretFile("S3_ACCESS_KEY_ID");
    let message = "";
    try {
      assertStorageConfigured();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("S3_ACCESS_KEY_ID_FILE is invalid");
    expect(message).not.toContain(file);
  });
});
