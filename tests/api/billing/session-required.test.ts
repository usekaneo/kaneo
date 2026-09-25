import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkout: vi.fn(async () => ({
    checkoutUrl: "https://example.invalid/checkout",
  })),
  portal: vi.fn(async () => ({ portalUrl: "https://example.invalid/portal" })),
  token: vi.fn(async () => ({ idToken: "sensitive-id-token" })),
  access: vi.fn(async () => {}),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: () => ({
      from: () => ({ where: async () => [{ role: "owner" }] }),
    }),
  },
}));
vi.mock("../../../apps/api/src/utils/validate-workspace-access", () => ({
  validateWorkspaceAccess: mocks.access,
}));
vi.mock("../../../apps/api/src/billing/controllers/create-checkout", () => ({
  default: mocks.checkout,
}));
vi.mock(
  "../../../apps/api/src/billing/controllers/get-workspace-billing",
  () => ({
    default: vi.fn(),
    getOrCreateWorkspaceBilling: async () => ({ creemCustomerId: "customer" }),
  }),
);
vi.mock("../../../apps/api/src/billing/controllers/handle-webhook", () => ({
  default: vi.fn(),
}));
vi.mock("../../../apps/api/src/billing/creem-client", () => ({
  createCustomerPortalLink: mocks.portal,
}));
vi.mock("../../../apps/api/src/oauth/controllers/get-id-token", () => ({
  default: mocks.token,
}));

const { default: billing } = await import("../../../apps/api/src/billing");
const { default: oauth } = await import("../../../apps/api/src/oauth");

function appFor(apiKey: object | null, session = true) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("userId", "owner");
    c.set("userEmail", "owner@example.invalid");
    if (apiKey) c.set("apiKey", apiKey);
    if (session) {
      c.set("user", { id: "owner" });
      c.set("session", { id: "session-owner" });
    }
    await next();
  });
  app.route("/billing", billing);
  app.route("/oauth", oauth);
  return app;
}

const endpoints = [
  ["/billing/workspace/checkout", "POST", mocks.checkout],
  ["/billing/workspace/portal", "POST", mocks.portal],
  ["/oauth/id-token", "GET", mocks.token],
] as const;

function request(app: ReturnType<typeof appFor>, url: string, method: string) {
  return app.request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(url.endsWith("checkout")
      ? { body: JSON.stringify({ plan: "team", interval: "monthly" }) }
      : {}),
  });
}

describe("sensitive account routes require a session", () => {
  beforeEach(() => vi.clearAllMocks());
  for (const [url, method, effect] of endpoints) {
    it.each([
      { id: "readonly-key", permissions: { task: ["read"] } },
      { id: "unrestricted-key", permissions: null },
    ])(
      `${method} ${url} rejects API keys even for an owner with a cookie`,
      async (key) => {
        const response = await request(appFor(key), url, method);
        expect(response.status).toBe(403);
        expect(effect).not.toHaveBeenCalled();
        expect(mocks.access).not.toHaveBeenCalled();
      },
    );
    it(`${method} ${url} rejects a missing session`, async () => {
      const response = await request(appFor(null, false), url, method);
      expect(response.status).toBe(403);
      expect(effect).not.toHaveBeenCalled();
    });
    it(`${method} ${url} accepts an owner session without caching its response`, async () => {
      const response = await request(appFor(null), url, method);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(effect).toHaveBeenCalledOnce();
    });
  }
});
