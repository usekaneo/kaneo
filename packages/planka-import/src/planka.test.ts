import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeBaseUrl, PlankaClient } from "./planka.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function captureHeaders() {
  const calls: Headers[] = [];
  globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    calls.push(new Headers(init?.headers));
    return new Response(JSON.stringify({ items: [], included: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return calls;
}

describe("PlankaClient auth headers", () => {
  it("sends an API key in x-api-key, never as a bearer", async () => {
    const calls = captureHeaders();
    await new PlankaClient({
      baseUrl: "https://planka.example.com",
      apiKey: "secret-key",
    }).listProjects();

    expect(calls[0]?.get("x-api-key")).toBe("secret-key");
    expect(calls[0]?.get("authorization")).toBeNull();
  });

  it("sends a session token as a bearer", async () => {
    const calls = captureHeaders();
    await new PlankaClient({
      baseUrl: "https://planka.example.com",
      token: "jwt-token",
    }).listProjects();

    expect(calls[0]?.get("authorization")).toBe("Bearer jwt-token");
    expect(calls[0]?.get("x-api-key")).toBeNull();
  });

  it("prefers the token when both are supplied", async () => {
    const calls = captureHeaders();
    await new PlankaClient({
      baseUrl: "https://planka.example.com",
      token: "jwt-token",
      apiKey: "secret-key",
    }).listProjects();

    expect(calls[0]?.get("authorization")).toBe("Bearer jwt-token");
    expect(calls[0]?.get("x-api-key")).toBeNull();
  });
});

describe("isAuthenticated", () => {
  it("is true with either credential and false with neither", () => {
    const base = "https://planka.example.com";
    expect(new PlankaClient({ baseUrl: base }).isAuthenticated).toBe(false);
    expect(
      new PlankaClient({ baseUrl: base, token: "t" }).isAuthenticated,
    ).toBe(true);
    expect(
      new PlankaClient({ baseUrl: base, apiKey: "k" }).isAuthenticated,
    ).toBe(true);
  });
});

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes and assumes https", () => {
    expect(normalizeBaseUrl("planka.example.com/")).toBe(
      "https://planka.example.com",
    );
    expect(normalizeBaseUrl("http://localhost:3000//")).toBe(
      "http://localhost:3000",
    );
  });
});
