import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: { select: (...args: unknown[]) => mockSelect(...args) },
  schema: {
    accountTable: {
      idToken: "id_token",
      userId: "user_id",
      providerId: "provider_id",
    },
  },
}));

import buildLogoutUrl from "../../../apps/api/src/oauth/controllers/build-logout-url";

function storedToken(idToken: string | null) {
  mockSelect.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(idToken === null ? [] : [{ idToken }]),
      }),
    }),
  });
}

const env = { ...process.env };

beforeEach(() => {
  mockSelect.mockReset();
  storedToken("stored-id-token");
});

afterEach(() => {
  process.env = { ...env };
});

describe("buildLogoutUrl", () => {
  it("returns null when the instance has no provider logout URL", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "";
    expect(await buildLogoutUrl("user-1")).toBeNull();
  });

  it("returns null rather than a broken redirect when the URL is malformed", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "not a url";
    expect(await buildLogoutUrl("user-1")).toBeNull();
  });

  it("attaches the stored id_token as id_token_hint", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "https://idp.example/logout";
    const url = new URL((await buildLogoutUrl("user-1")) as string);
    expect(url.searchParams.get("id_token_hint")).toBe("stored-id-token");
  });

  it("omits id_token_hint when the user has no stored token", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "https://idp.example/logout";
    storedToken(null);
    const url = new URL((await buildLogoutUrl("user-1")) as string);
    expect(url.searchParams.has("id_token_hint")).toBe(false);
  });

  it("takes post_logout_redirect_uri from configuration only", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "https://idp.example/logout";
    process.env.KANEO_CLIENT_URL = "https://kaneo.example/";
    const url = new URL((await buildLogoutUrl("user-1")) as string);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://kaneo.example/auth/sign-in",
    );
  });

  it("omits post_logout_redirect_uri when no client URL is configured, rather than trusting the request", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "https://idp.example/logout";
    process.env.KANEO_CLIENT_URL = "";
    const url = new URL((await buildLogoutUrl("user-1")) as string);
    expect(url.searchParams.has("post_logout_redirect_uri")).toBe(false);
  });

  it("refuses a cleartext provider URL so the token is not sent in the open", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "http://idp.example/logout";
    expect(await buildLogoutUrl("user-1")).toBeNull();
  });

  it("allows http for a loopback provider during local development", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "http://localhost:8080/logout";
    expect(await buildLogoutUrl("user-1")).not.toBeNull();
  });

  it("preserves query parameters already on the configured URL", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL =
      "https://idp.example/logout?realm=kaneo";
    const url = new URL((await buildLogoutUrl("user-1")) as string);
    expect(url.searchParams.get("realm")).toBe("kaneo");
  });
});

describe("logout redirect ordering", () => {
  it("keeps working when the provider URL cannot be built", async () => {
    process.env.CUSTOM_OAUTH_LOGOUT_URL = "https://idp.example/logout";
    mockSelect.mockImplementation(() => {
      throw new Error("database unavailable");
    });
    await expect(buildLogoutUrl("user-1")).rejects.toThrow(
      "database unavailable",
    );
  });
});
