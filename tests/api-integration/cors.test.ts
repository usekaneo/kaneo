import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";

const originalNodeEnv = process.env.NODE_ENV;
const originalClientUrl = process.env.KANEO_CLIENT_URL;
const originalCorsOrigins = process.env.CORS_ORIGINS;

function restore(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restore("NODE_ENV", originalNodeEnv);
  restore("KANEO_CLIENT_URL", originalClientUrl);
  restore("CORS_ORIGINS", originalCorsOrigins);
});

async function originHeaderFor(requestOrigin: string) {
  const { app } = createApp();
  const response = await app.request("/api/health", {
    headers: { origin: requestOrigin },
  });
  return response.headers.get("access-control-allow-origin");
}

describe("API integration: CORS origin policy", () => {
  it("refuses unconfigured cross-origin requests in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.KANEO_CLIENT_URL;
    delete process.env.CORS_ORIGINS;

    expect(await originHeaderFor("https://attacker.example")).toBeNull();
  });

  it("still reflects the origin in development", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.KANEO_CLIENT_URL;
    delete process.env.CORS_ORIGINS;

    expect(await originHeaderFor("http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
  });

  it("allows the configured client URL and refuses everything else", async () => {
    process.env.NODE_ENV = "production";
    process.env.KANEO_CLIENT_URL = "https://kaneo.example";
    delete process.env.CORS_ORIGINS;

    expect(await originHeaderFor("https://kaneo.example")).toBe(
      "https://kaneo.example",
    );
    expect(await originHeaderFor("https://attacker.example")).toBeNull();
  });

  it("honours a comma-separated CORS_ORIGINS allowlist", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.KANEO_CLIENT_URL;
    process.env.CORS_ORIGINS = "https://a.example, https://b.example";

    expect(await originHeaderFor("https://b.example")).toBe(
      "https://b.example",
    );
    expect(await originHeaderFor("https://c.example")).toBeNull();
  });
});
