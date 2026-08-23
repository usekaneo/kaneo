import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

vi.hoisted(() => {
  process.env.CUSTOM_OAUTH_CLIENT_ID = "test-client";
  process.env.CUSTOM_OAUTH_CLIENT_SECRET = "test-secret";
  process.env.CUSTOM_OAUTH_AUTHORIZATION_URL =
    "https://identity.example.com/authorize";
  process.env.CUSTOM_OAUTH_TOKEN_URL = "https://identity.example.com/token";
  process.env.CUSTOM_OAUTH_USER_INFO_URL =
    "https://identity.example.com/userinfo";
  process.env.CUSTOM_OAUTH_ASSUME_EMAIL_VERIFIED = "true";
});

type SessionResponse = { user: { emailVerified: boolean } } | null;

let providerProfile: {
  sub: string;
  email?: string;
  name: string;
  email_verified?: boolean | string;
};

function applyCookies(existing: string, response: Response) {
  const jar = new Map<string, string>();

  for (const pair of existing.split("; ").filter(Boolean)) {
    const [name, ...value] = pair.split("=");
    if (name) jar.set(name, value.join("="));
  }

  for (const setCookie of response.headers.getSetCookie()) {
    const [pair] = setCookie.split(";");
    const [name, ...value] = (pair ?? "").split("=");
    if (!name) continue;
    if (value.join("=") === "") {
      jar.delete(name);
      continue;
    }
    jar.set(name, value.join("="));
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function mockProviderFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);

      if (url.href === "https://identity.example.com/token") {
        return Response.json({
          access_token: "test-access-token",
          token_type: "Bearer",
        });
      }

      if (url.href === "https://identity.example.com/userinfo") {
        return Response.json(providerProfile);
      }

      throw new Error(`Unexpected request to ${url.href}`);
    }),
  );
}

async function seedLinkedUser(emailVerified: boolean) {
  const id = `user-${randomUUID()}`;
  const email = `${id}@example.com`;
  const accountId = `account-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email, emailVerified, name: "Custom OAuth User" })
    .returning();
  if (!user) throw new Error("Failed to seed custom OAuth user");

  await db.insert(schema.accountTable).values({
    accountId,
    providerId: "custom",
    userId: id,
  });

  return { accountId, email, user };
}

async function signInWithCustomOAuth(app: ReturnType<typeof createApp>["app"]) {
  const start = await app.request("/api/auth/sign-in/oauth2", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      providerId: "custom",
      callbackURL: "http://localhost:5173",
    }),
  });
  expect(start.status).toBe(200);

  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  expect(state).toBeTruthy();

  const stateCookies = applyCookies("", start);
  const callback = await app.request(
    `/api/auth/oauth2/callback/custom?code=test-code&state=${encodeURIComponent(
      state ?? "",
    )}`,
    { headers: { cookie: stateCookies } },
  );
  expect(callback.status).toBe(302);

  return {
    callback,
    cookies: applyCookies(stateCookies, callback),
  };
}

describe("API integration: custom OAuth email verification", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    mockProviderFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes the issued session after promoting a linked user's email", async () => {
    const linked = await seedLinkedUser(false);
    providerProfile = {
      sub: linked.accountId,
      email: linked.email,
      name: linked.user.name,
    };

    const { app } = createApp();
    const { cookies } = await signInWithCustomOAuth(app);

    const [storedUser] = await db
      .select({ emailVerified: schema.userTable.emailVerified })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, linked.user.id));
    expect(storedUser?.emailVerified).toBe(true);

    const session = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(session?.user.emailVerified).toBe(true);
  });

  it("keeps the stored user and issued session unverified for an explicit false claim", async () => {
    const linked = await seedLinkedUser(false);
    providerProfile = {
      sub: linked.accountId,
      email: linked.email,
      name: linked.user.name,
      email_verified: false,
    };

    const { app } = createApp();
    const { cookies } = await signInWithCustomOAuth(app);

    const [storedUser] = await db
      .select({ emailVerified: schema.userTable.emailVerified })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, linked.user.id));
    expect(storedUser?.emailVerified).toBe(false);

    const session = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(session?.user.emailVerified).toBe(false);
  });

  it("keeps the stored user and issued session unverified for a malformed claim", async () => {
    const linked = await seedLinkedUser(false);
    providerProfile = {
      sub: linked.accountId,
      email: linked.email,
      name: linked.user.name,
      email_verified: "false",
    };

    const { app } = createApp();
    const { cookies } = await signInWithCustomOAuth(app);

    const [storedUser] = await db
      .select({ emailVerified: schema.userTable.emailVerified })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, linked.user.id));
    expect(storedUser?.emailVerified).toBe(false);

    const session = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(session?.user.emailVerified).toBe(false);
  });

  it("does not promote a linked user when the provider omits the email claim", async () => {
    const linked = await seedLinkedUser(false);
    providerProfile = {
      sub: linked.accountId,
      name: linked.user.name,
    };

    const { app } = createApp();
    const { callback, cookies } = await signInWithCustomOAuth(app);

    expect(callback.headers.get("location")).toContain("email_is_missing");

    const [storedUser] = await db
      .select({ emailVerified: schema.userTable.emailVerified })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, linked.user.id));
    expect(storedUser?.emailVerified).toBe(false);

    const session = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(session).toBeNull();
  });
});
