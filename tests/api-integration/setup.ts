import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, vi } from "vitest";

function stripEnvValueQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function deriveTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");

  if (!databaseName || databaseName.endsWith("_test")) {
    return connectionString;
  }

  url.pathname = `/${databaseName}_test`;
  return url.toString();
}

function assertTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Integration tests require DATABASE_URL to use a database name ending in _test (got "${databaseName}")`,
    );
  }
}

function readDatabaseUrlFromEnvFile() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(currentDir, "../../.env");

  if (!existsSync(envPath)) {
    return null;
  }

  const envFile = readFileSync(envPath, "utf8");
  const match = envFile.match(/^DATABASE_URL=(.+)$/m);
  const raw = match?.[1]?.trim();
  return raw ? stripEnvValueQuotes(raw) : null;
}

const defaultTestDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/kaneo_test";
const envDatabaseUrl = process.env.DATABASE_URL?.trim();
const fromEnv = envDatabaseUrl ? stripEnvValueQuotes(envDatabaseUrl) : "";
const rawDatabaseUrl =
  fromEnv || readDatabaseUrlFromEnvFile() || defaultTestDatabaseUrl;
process.env.DATABASE_URL = deriveTestDatabaseUrl(rawDatabaseUrl);
assertTestDatabaseUrl(process.env.DATABASE_URL);

process.env.NODE_ENV = "test";
process.env.AUTH_SECRET = "test-secret-with-at-least-32-chars";
process.env.KANEO_API_URL = "http://localhost:1337";
process.env.KANEO_CLIENT_URL = "http://localhost:5173";
process.env.DISABLE_GUEST_ACCESS = "false";
process.env.DISABLE_REGISTRATION = "false";
process.env.DISABLE_PASSWORD_REGISTRATION = "false";
process.env.DEMO_MODE = "false";
process.env.SMTP_HOST = "";
process.env.SMTP_PORT = "";
process.env.SMTP_SECURE = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASSWORD = "";
process.env.GITHUB_OAUTH_CLIENT_ID = "";
process.env.GITHUB_OAUTH_CLIENT_SECRET = "";
process.env.GITHUB_CLIENT_ID = "";
process.env.GITHUB_CLIENT_SECRET = "";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.DISCORD_CLIENT_ID = "";
process.env.DISCORD_CLIENT_SECRET = "";
process.env.CUSTOM_OAUTH_CLIENT_ID = "";
process.env.CUSTOM_OAUTH_CLIENT_SECRET = "";
process.env.CUSTOM_OAUTH_AUTHORIZATION_URL = "";
process.env.CUSTOM_OAUTH_TOKEN_URL = "";
process.env.CUSTOM_OAUTH_USER_INFO_URL = "";
process.env.CUSTOM_OAUTH_SCOPES = "";
process.env.CUSTOM_OAUTH_RESPONSE_TYPE = "";
process.env.CUSTOM_OAUTH_DISCOVERY_URL = "";
process.env.DEVICE_AUTH_CLIENT_IDS = "kaneo-cli";

afterEach(() => {
  vi.restoreAllMocks();
});
