import { generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

vi.hoisted(() => {
  process.env.CUSTOM_OAUTH_CLIENT_ID = "kaneo-test";
  process.env.CUSTOM_OAUTH_CLIENT_SECRET = "kaneo-test-secret";
  process.env.CUSTOM_OAUTH_DISCOVERY_URL =
    "https://idp.example.com/.well-known/openid-configuration";
  process.env.CUSTOM_OAUTH_SCOPES = "openid,profile,email";
  vi.stubGlobal("fetch", async () =>
    Response.json({
      issuer: "https://idp.example.com",
      authorization_endpoint: "https://idp.example.com/authorize",
      token_endpoint: "https://idp.example.com/token",
      jwks_uri: "https://idp.example.com/jwks",
    }),
  );
});

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubGlobal("fetch", async () =>
    Response.json({
      keys: [{ ...publicKey.export({ format: "jwk" }), kid: "id-token-test" }],
    }),
  );
});

describe("custom OAuth ID-token sign-in", () => {
  it.each(["unmanaged", "managed", "backchannel"])(
    "requires the callback for %s provider sessions",
    async (mode) => {
      vi.stubEnv(
        "CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS",
        mode === "managed" ? "name" : "",
      );
      vi.stubEnv(
        "CUSTOM_OAUTH_BACKCHANNEL_LOGOUT",
        mode === "backchannel" ? "true" : "false",
      );
      const now = Math.floor(Date.now() / 1000);
      const input = `${encode({ alg: "RS256", kid: "id-token-test" })}.${encode(
        {
          iss: "https://idp.example.com",
          aud: "kaneo-test",
          sub: "id-token-user",
          sid: "provider-session",
          name: "ID Token User",
          email: "id-token@example.com",
          email_verified: true,
          iat: now,
          exp: now + 120,
        },
      )}`;
      const token = `${input}.${sign("sha256", Buffer.from(input), privateKey).toString("base64url")}`;
      const { app } = createApp();
      const response = await app.request("/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({ provider: "custom", idToken: { token } }),
      });

      expect(response.status).toBe(mode === "unmanaged" ? 200 : 404);
      expect(await db.select().from(schema.sessionTable)).toHaveLength(
        mode === "unmanaged" ? 1 : 0,
      );
    },
  );
});
