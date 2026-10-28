import { describe, expect, it, vi } from "vite-plus/test";
import type { FetchLike } from "../types.js";
import { PlankaClient } from "./client.js";

const BASE = "https://planka.example.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function recorder(respond: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit; headers: Headers }[] = [];
  const fetch: FetchLike = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init, headers: new Headers(init?.headers) });
    return respond(url, init);
  });
  return { calls, fetch };
}

function emptyProjects() {
  return recorder(() => json({ items: [], included: {} }));
}

describe("PlankaClient auth headers", () => {
  it("sends an API key in x-api-key, never as a bearer", async () => {
    const { calls, fetch } = emptyProjects();
    await new PlankaClient({
      baseUrl: BASE,
      apiKey: "secret-key",
      fetch,
    }).listProjects();

    expect(calls[0]?.headers.get("x-api-key")).toBe("secret-key");
    expect(calls[0]?.headers.get("authorization")).toBeNull();
  });

  it("sends a session token as a bearer", async () => {
    const { calls, fetch } = emptyProjects();
    await new PlankaClient({
      baseUrl: BASE,
      token: "jwt-token",
      fetch,
    }).listProjects();

    expect(calls[0]?.headers.get("authorization")).toBe("Bearer jwt-token");
    expect(calls[0]?.headers.get("x-api-key")).toBeNull();
  });

  it("prefers the token when both are supplied", async () => {
    const { calls, fetch } = emptyProjects();
    await new PlankaClient({
      baseUrl: BASE,
      token: "jwt-token",
      apiKey: "secret-key",
      fetch,
    }).listProjects();

    expect(calls[0]?.headers.get("authorization")).toBe("Bearer jwt-token");
    expect(calls[0]?.headers.get("x-api-key")).toBeNull();
  });

  it("keeps the credentials when scoped to another signal", async () => {
    const { calls, fetch } = emptyProjects();
    const client = new PlankaClient({ baseUrl: BASE, apiKey: "k", fetch });
    await client.withSignal(new AbortController().signal).listProjects();

    expect(calls[0]?.headers.get("x-api-key")).toBe("k");
  });
});

describe("isAuthenticated", () => {
  it("is true with either credential and false with neither", () => {
    expect(new PlankaClient({ baseUrl: BASE }).isAuthenticated).toBe(false);
    expect(
      new PlankaClient({ baseUrl: BASE, token: "t" }).isAuthenticated,
    ).toBe(true);
    expect(
      new PlankaClient({ baseUrl: BASE, apiKey: "k" }).isAuthenticated,
    ).toBe(true);
  });
});

describe("baseUrl", () => {
  it("strips trailing slashes and assumes https", () => {
    expect(new PlankaClient({ baseUrl: "planka.example.com/" }).baseUrl).toBe(
      "https://planka.example.com",
    );
    expect(
      new PlankaClient({ baseUrl: "http://localhost:3000//" }).baseUrl,
    ).toBe("http://localhost:3000");
  });
});

describe("login", () => {
  it("posts the credentials and then uses the token as a bearer", async () => {
    const { calls, fetch } = recorder((url) =>
      url.endsWith("/api/access-tokens")
        ? json({ item: "jwt-token" })
        : json({ items: [], included: {} }),
    );
    const client = new PlankaClient({ baseUrl: BASE, fetch });

    await client.login("sam", "hunter2");
    await client.listProjects();

    expect(calls[0]?.url).toBe(`${BASE}/api/access-tokens`);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      emailOrUsername: "sam",
      password: "hunter2",
    });
    expect(calls[0]?.headers.get("content-type")).toBe("application/json");
    expect(client.isAuthenticated).toBe(true);
    expect(calls[1]?.headers.get("authorization")).toBe("Bearer jwt-token");
  });

  it("explains the accept-terms step", async () => {
    const { fetch } = recorder(() =>
      json({ code: "E_FORBIDDEN", step: "accept-terms" }, 403),
    );

    await expect(
      new PlankaClient({ baseUrl: BASE, fetch }).login("sam", "pw"),
    ).rejects.toThrow(
      "This PLANKA instance requires you to accept its terms before the API will issue a token. Sign in once through the PLANKA web UI, accept the terms, then try again.",
    );
  });

  it("points two-factor accounts at an API key", async () => {
    const { fetch } = recorder(() =>
      json({ code: "E_FORBIDDEN", step: "verify-totp" }, 403),
    );

    await expect(
      new PlankaClient({ baseUrl: BASE, fetch }).login("sam", "pw"),
    ).rejects.toThrow(
      "This PLANKA account has two-factor authentication enabled, which password login cannot complete. Create a PLANKA API key for the account and use it instead.",
    );
  });

  it("reports a rejected password without echoing it", async () => {
    const { fetch } = recorder(() => json({ code: "E_UNAUTHORIZED" }, 401));

    const error = await new PlankaClient({ baseUrl: BASE, fetch })
      .login("sam", "hunter2")
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "PLANKA /api/access-tokens: unauthorized (HTTP 401), check your PLANKA credentials or token",
    );
    expect((error as Error).message).not.toContain("hunter2");
  });

  it("fails clearly when no token comes back", async () => {
    const { fetch } = recorder(() => json({}));

    await expect(
      new PlankaClient({ baseUrl: BASE, fetch }).login("sam", "pw"),
    ).rejects.toThrow(
      "PLANKA did not return an access token. Create a PLANKA API key for the account and use it instead.",
    );
  });
});

describe("listComments", () => {
  it("pages with beforeId and returns the comments oldest first", async () => {
    const pages: Record<string, unknown> = {
      [`${BASE}/api/cards/c1/comments`]: {
        items: [
          { id: "m3", cardId: "c1", userId: "u1", text: "third" },
          { id: "m2", cardId: "c1", userId: "u2", text: "second" },
        ],
        included: { users: [{ id: "u1", name: "Sam" }] },
      },
      [`${BASE}/api/cards/c1/comments?beforeId=m2`]: {
        items: [{ id: "m1", cardId: "c1", userId: "u2", text: "first" }],
        included: { users: [{ id: "u2", name: "Ana" }] },
      },
      [`${BASE}/api/cards/c1/comments?beforeId=m1`]: { items: [] },
    };
    const { calls, fetch } = recorder((url) => json(pages[url] ?? {}, 200));

    const result = await new PlankaClient({
      baseUrl: BASE,
      apiKey: "k",
      fetch,
    }).listComments("c1");

    expect(calls.map((call) => call.url)).toEqual(Object.keys(pages));
    expect(result.comments.map((comment) => comment.text)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(result.users.map((user) => user.id).sort()).toEqual(["u1", "u2"]);
  });
});
