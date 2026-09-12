import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

type SessionResponse = { user: { image: string | null; name: string } } | null;

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

function collectCookies(response: Response) {
  return applyCookies("", response);
}

async function signUp(app: ReturnType<typeof createApp>["app"]) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "avatar-session@example.com",
      password: "correct horse battery staple",
      name: "Avatar Session",
    }),
  });

  expect(response.status).toBe(200);
  const cookies = collectCookies(response);
  expect(cookies).not.toBe("");

  return cookies;
}

describe("API integration: session freshness after profile updates", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("serves the updated user when the session cookie cache is bypassed", async () => {
    const { app } = createApp();
    const cookies = await signUp(app);

    const update = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ image: "/api/user/avatar/new-avatar-id" }),
    });
    expect(update.status).toBe(200);

    const cached = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(cached?.user.image).toBeNull();

    const fresh = (await (
      await app.request("/api/auth/get-session?disableCookieCache=true", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(fresh?.user.image).toBe("/api/user/avatar/new-avatar-id");
  });

  it("refreshes the cached session cookie on get-session", async () => {
    const { app } = createApp();
    const cookies = await signUp(app);

    await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ name: "Renamed User" }),
    });

    const refreshed = await app.request(
      "/api/auth/get-session?disableCookieCache=true",
      { headers: { cookie: cookies } },
    );

    expect(refreshed.headers.getSetCookie().length).toBeGreaterThan(0);

    const nextCookies = applyCookies(cookies, refreshed);
    const cached = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: nextCookies },
      })
    ).json()) as SessionResponse;

    expect(cached?.user.name).toBe("Renamed User");
  });
});
