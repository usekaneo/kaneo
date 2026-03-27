import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, vi } from "vitest";

function deriveTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");

  if (!databaseName || databaseName.endsWith("_test")) {
    return connectionString;
  }

  url.pathname = `/${databaseName}_test`;
  return url.toString();
}

function readDatabaseUrlFromEnvFile() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(currentDir, "../../.env");

  if (!existsSync(envPath)) {
    return null;
  }

  const envFile = readFileSync(envPath, "utf8");
  const match = envFile.match(/^DATABASE_URL=(.+)$/m);
  return match?.[1]?.trim() || null;
}

process.env.NODE_ENV = "test";
process.env.AUTH_SECRET = "test-secret-with-at-least-32-chars";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  deriveTestDatabaseUrl(
    readDatabaseUrlFromEnvFile() ||
      "postgresql://postgres:postgres@localhost:5432/kaneo_test",
  );
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
process.env.GITHUB_CLIENT_ID = "";
process.env.GITHUB_CLIENT_SECRET = "";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.DISCORD_CLIENT_ID = "";
process.env.DISCORD_CLIENT_SECRET = "";
process.env.CUSTOM_OAUTH_CLIENT_ID = "";
process.env.CUSTOM_OAUTH_CLIENT_SECRET = "";

afterEach(() => {
  vi.restoreAllMocks();
});
