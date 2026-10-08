import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import { createWorkspaceMember } from "./helpers/fixtures";

const LIMIT = 3;
const WINDOW = 60_000;

beforeEach(resetTestDatabase);

async function seedKey(
  overrides: Partial<typeof schema.apikeyTable.$inferInsert> = {},
) {
  const { user, workspace } = await createWorkspaceMember();
  const key = `rate-limit-test-${user.id}`.padEnd(64, "x");
  const [row] = await db
    .insert(schema.apikeyTable)
    .values({
      referenceId: user.id,
      userId: user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      createdAt: new Date(),
      updatedAt: new Date(),
      rateLimitEnabled: true,
      rateLimitMax: LIMIT,
      rateLimitTimeWindow: WINDOW,
      ...overrides,
    })
    .returning();
  return { key, row, workspace };
}

async function fillWindow(id: string, lastRequest: Date) {
  await db
    .update(schema.apikeyTable)
    .set({ requestCount: LIMIT, lastRequest })
    .where(eq(schema.apikeyTable.id, id));
}

async function savedKey(id: string) {
  const [row] = await db
    .select()
    .from(schema.apikeyTable)
    .where(eq(schema.apikeyTable.id, id));
  return row;
}

function limitHeaders(response: Response) {
  return {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset"),
    retryAfter: response.headers.get("retry-after"),
  };
}

const rateLimited = { message: "Rate limit exceeded", code: "RATE_LIMITED" };
const usageExceeded = {
  message: "API key usage limit exceeded",
  code: "RATE_LIMITED",
};

function epochSeconds(date: Date) {
  return String(Math.ceil(date.getTime() / 1000));
}

describe("API key rate limits", () => {
  it("reports the window on every successful key request", async () => {
    const { key } = await seedKey();
    const { app } = createApp();

    const before = Date.now();
    const first = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });
    const after = Date.now();

    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private");
    const headers = limitHeaders(first);
    expect(headers).toMatchObject({
      limit: String(LIMIT),
      remaining: String(LIMIT - 1),
      retryAfter: null,
    });
    expect(Number(headers.reset)).toBeGreaterThanOrEqual(
      Math.ceil((before + WINDOW) / 1000),
    );
    expect(Number(headers.reset)).toBeLessThanOrEqual(
      Math.ceil((after + WINDOW) / 1000),
    );

    const second = await app.request("/api/user/me", {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(second.status).toBe(200);
    expect(limitHeaders(second).remaining).toBe(String(LIMIT - 2));
  });

  it.each([
    ["x-api-key", (key: string) => ({ "x-api-key": key })],
    ["a Bearer key", (key: string) => ({ Authorization: `Bearer ${key}` })],
  ])("answers 429 with retry headers via %s", async (_, headersFor) => {
    const { key, row } = await seedKey();
    const lastRequest = new Date(Date.now() - 45_000);
    await fillWindow(row.id, lastRequest);
    const { app } = createApp();

    const response = await app.request("/api/user/me", {
      headers: headersFor(key),
    });

    expect(response.status).toBe(429);
    expect(await readErrorBody(response)).toEqual(rateLimited);
    const headers = limitHeaders(response);
    expect(headers).toMatchObject({
      limit: String(LIMIT),
      remaining: "0",
      reset: epochSeconds(new Date(lastRequest.getTime() + WINDOW)),
    });
    expect(Number(headers.retryAfter)).toBeGreaterThanOrEqual(14);
    expect(Number(headers.retryAfter)).toBeLessThanOrEqual(15);

    const saved = await savedKey(row.id);
    expect(saved.requestCount).toBe(LIMIT);
    expect(saved.lastRequest?.getTime()).toBe(lastRequest.getTime());
  });

  it("answers 429 on Better Auth routes", async () => {
    const { key, row } = await seedKey();
    const { app } = createApp();

    const allowed = await app.request("/api/auth/get-session", {
      headers: { "x-api-key": key },
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      user: { id: row.referenceId },
    });
    expect(limitHeaders(allowed)).toMatchObject({
      limit: String(LIMIT),
      remaining: String(LIMIT - 1),
    });

    await fillWindow(row.id, new Date());

    const limited = await app.request("/api/auth/get-session", {
      headers: { "x-api-key": key },
    });
    expect(limited.status).toBe(429);
    expect(await readErrorBody(limited)).toEqual(rateLimited);
    expect(limitHeaders(limited)).toMatchObject({
      limit: String(LIMIT),
      remaining: "0",
    });
    expect(Number(limitHeaders(limited).retryAfter)).toBeGreaterThanOrEqual(59);

    const bearer = await app.request("/api/auth/organization/list", {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(bearer.status).toBe(429);
    expect(await readErrorBody(bearer)).toEqual(rateLimited);
    expect(limitHeaders(bearer).remaining).toBe("0");
    expect(limitHeaders(bearer).retryAfter).not.toBeNull();
  });

  it.each([
    [
      "x-api-key",
      "/api/auth/get-session",
      (key: string) => ({ "x-api-key": key }),
    ],
    [
      "a Bearer key",
      "/api/auth/organization/list",
      (key: string) => ({ Authorization: `Bearer ${key}` }),
    ],
  ])(
    "reports the window on an auth request that spends the last quota unit via %s",
    async (_, path, headersFor) => {
      const { key, row } = await seedKey({ remaining: 1 });
      const { app } = createApp();

      const response = await app.request(path, { headers: headersFor(key) });

      expect(response.status).toBe(200);
      expect(limitHeaders(response)).toMatchObject({
        limit: String(LIMIT),
        remaining: String(LIMIT - 1),
        retryAfter: null,
      });
      expect((await savedKey(row.id)).remaining).toBe(0);
    },
  );

  it.each([
    [
      "x-api-key",
      "/api/auth/get-session",
      (key: string) => ({ "x-api-key": key }),
    ],
    [
      "a Bearer key",
      "/api/auth/organization/list",
      (key: string) => ({ Authorization: `Bearer ${key}` }),
    ],
  ])(
    "adds retry headers when the window fills before Better Auth checks a key via %s",
    async (_, path, headersFor) => {
      const { key, row } = await seedKey();
      const handler = auth.handler;
      vi.spyOn(auth, "handler").mockImplementationOnce(async (request) => {
        await fillWindow(row.id, new Date());
        return handler(request);
      });
      const { app } = createApp();

      const response = await app.request(path, { headers: headersFor(key) });

      expect(response.status).toBe(429);
      const headers = limitHeaders(response);
      expect(headers).toMatchObject({ limit: String(LIMIT), remaining: "0" });
      expect(Number(headers.retryAfter)).toBeGreaterThanOrEqual(59);
      expect(Number(headers.retryAfter)).toBeLessThanOrEqual(60);
    },
  );

  it.each([
    [
      "x-api-key",
      "/api/auth/get-session",
      (key: string) => ({ "x-api-key": key }),
    ],
    [
      "a Bearer key",
      "/api/auth/organization/list",
      (key: string) => ({ Authorization: `Bearer ${key}` }),
    ],
  ])(
    "answers Better Auth's own 429 with its Retry-After and no key window via %s",
    async (_, path, headersFor) => {
      const { key, row } = await seedKey();
      vi.spyOn(auth, "handler").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Too many requests. Please try again later.",
          }),
          { status: 429, headers: { "X-Retry-After": "42" } },
        ),
      );
      const { app } = createApp();

      const response = await app.request(path, { headers: headersFor(key) });

      expect(response.status).toBe(429);
      expect(limitHeaders(response)).toEqual({
        limit: null,
        remaining: null,
        reset: null,
        retryAfter: "42",
      });
      expect(await response.json()).toEqual({
        message: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
      });
      expect(response.headers.get("cache-control")).toBe("private");
      expect((await savedKey(row.id)).requestCount).toBe(0);
    },
  );

  it("still answers when the rate limit headers cannot be read", async () => {
    const { key, row } = await seedKey();
    const handler = auth.handler;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(auth, "handler").mockImplementationOnce(async (request) => {
      const response = await handler(request);
      vi.spyOn(getDatabase(), "select").mockImplementationOnce(() => {
        throw new Error("database unavailable");
      });
      return response;
    });
    const { app } = createApp();

    const response = await app.request("/api/auth/get-session", {
      headers: { "x-api-key": key },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: row.referenceId },
    });
    expect(limitHeaders(response).limit).toBeNull();
    expect(errors).toHaveBeenCalledWith(
      "Failed to read API key usage:",
      expect.any(Error),
    );
  });

  it("lets the key through again after a full window", async () => {
    const { key, row } = await seedKey();
    await fillWindow(row.id, new Date(Date.now() - WINDOW - 1_000));
    const { app } = createApp();

    const response = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });

    expect(response.status).toBe(200);
    expect(limitHeaders(response).remaining).toBe(String(LIMIT - 1));
  });

  it.each([
    ["x-api-key", { "x-api-key": "not-a-real-key" }],
    ["Bearer", { Authorization: "Bearer not-a-real-key" }],
  ])("keeps answering 401 for an unknown key in %s", async (_, headers) => {
    const { app } = createApp();

    const response = await app.request("/api/user/me", { headers });

    expect(response.status).toBe(401);
    expect(await readErrorBody(response)).toEqual({
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    expect(limitHeaders(response)).toMatchObject({
      limit: null,
      retryAfter: null,
    });
  });

  it("sends no rate limit headers on session requests", async () => {
    const { app } = createApp();
    const { cookies } = await signUpWithSession(app, {
      email: `${randomUUID()}@example.com`,
      name: "Session User",
    });

    const response = await app.request("/api/user/me", {
      headers: { cookie: cookies },
    });

    expect(response.status).toBe(200);
    expect(limitHeaders(response)).toEqual({
      limit: null,
      remaining: null,
      reset: null,
      retryAfter: null,
    });
  });

  it("keeps the headers when the route itself fails", async () => {
    const { key, workspace } = await seedKey();
    const { app } = createApp();

    const missing = await app.request(
      `/api/workspace/${workspace.id}/members?projectId=${randomUUID()}`,
      { headers: { "x-api-key": key } },
    );
    expect(missing.status).toBe(404);
    expect(await readErrorBody(missing)).toEqual({
      message: "Project not found",
      code: "NOT_FOUND",
    });
    expect(limitHeaders(missing)).toMatchObject({
      limit: String(LIMIT),
      remaining: String(LIMIT - 1),
    });
    expect(missing.headers.get("cache-control")).toBe("private");

    const unknownRoute = await app.request("/api/no-such-route", {
      headers: { "x-api-key": key },
    });
    expect(unknownRoute.status).toBe(404);
    expect(limitHeaders(unknownRoute).remaining).toBe(String(LIMIT - 2));
    expect(unknownRoute.headers.get("cache-control")).toBe("private");
  });

  it("answers 429 when the usage quota is exhausted", async () => {
    const lastRefillAt = new Date(Date.now() - 600_000);
    const { key, row } = await seedKey({
      remaining: 0,
      refillAmount: 5,
      refillInterval: 3_600_000,
      lastRefillAt,
    });
    const { app } = createApp();

    const response = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });

    expect(response.status).toBe(429);
    expect(await readErrorBody(response)).toEqual(usageExceeded);
    const retryAfter = Number(limitHeaders(response).retryAfter);
    expect(retryAfter).toBeGreaterThanOrEqual(2_999);
    expect(retryAfter).toBeLessThanOrEqual(3_000);
    expect(limitHeaders(response).limit).toBeNull();
    expect((await savedKey(row.id)).remaining).toBe(0);
  });

  it("answers 429 without Retry-After when the quota never refills", async () => {
    const { key } = await seedKey({ remaining: 0 });
    const { app } = createApp();

    for (const headers of [
      { "x-api-key": key },
      { Authorization: `Bearer ${key}` },
    ]) {
      const response = await app.request("/api/user/me", { headers });
      expect(response.status).toBe(429);
      expect(await readErrorBody(response)).toEqual(usageExceeded);
      expect(limitHeaders(response).retryAfter).toBeNull();
    }
  });
});
