import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { invalidateInstanceSettings } from "../../apps/api/src/instance-settings/get-instance-settings";
import { requireEffectiveAgentConfig } from "../../apps/api/src/agent/effective-config";
import { executeAgentRun } from "../../apps/api/src/agent/runner";
import { auth } from "../../apps/api/src/auth";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const sonnet = "anthropic:claude-sonnet-5-5";
const haiku = "anthropic:claude-haiku-5-5";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("KANEO_AGENT_MODEL", sonnet);
  vi.stubEnv("KANEO_AGENT_MODELS", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-admin-model-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup(instanceAdmin = true) {
  const ctx = await createWorkspaceMember({ role: "admin" });
  const [user] = await db
    .update(schema.userTable)
    .set({ role: instanceAdmin ? "admin" : "user" })
    .where(eq(schema.userTable.id, ctx.user.id))
    .returning();
  mockAuthenticatedSession(user!);
  const { app } = createApp();
  const patch = (policy: unknown) =>
    app.request("/api/admin/agent/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ policy }),
    });
  const post = (path: string, body: unknown) =>
    app.request(`/api/agent/${ctx.workspace.id}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { ...ctx, app, patch, post };
}

it("lets an instance admin persist models and a default used by new runs", async () => {
  const ctx = await setup();
  const policy = { model: haiku, models: [sonnet, haiku] };
  const response = await ctx.patch(policy);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ managed: true, model: haiku });
  invalidateInstanceSettings();
  const config = await ctx.app.request(`/api/agent/${ctx.workspace.id}/config`);
  expect(await config.json()).toMatchObject({
    enabled: true,
    model: haiku,
    models: [{ id: sonnet }, { id: haiku }],
  });
  const conversation = await (await ctx.post("/conversations", {})).json();
  const created = await ctx.post(`/conversations/${conversation.id}/runs`, {
    requestId: randomUUID(),
    prompt: "Hello",
  });
  expect(created.status).toBe(202);
  const { id } = await created.json();
  const [run] = await db
    .select()
    .from(schema.agentRunTable)
    .where(eq(schema.agentRunTable.id, id));
  expect(run?.model).toBe(haiku);
  const [stored] = await db.select().from(schema.instanceSettingsTable);
  expect(stored?.agentModels).toEqual(policy);
  const [audit] = await db.select().from(schema.adminAuditLogTable);
  expect(JSON.stringify(audit?.metadata)).toContain("agentModels");
  expect(JSON.stringify(audit?.metadata)).not.toContain(
    "synthetic-admin-model-key",
  );
});

it("rejects workspace administrators without instance settings permission", async () => {
  const ctx = await setup(false);
  expect((await ctx.patch({ model: sonnet, models: [sonnet] })).status).toBe(
    403,
  );
  expect((await ctx.app.request("/api/admin/agent/settings")).status).toBe(403);
  expect(
    (await ctx.app.request("/api/admin/agent/models?provider=anthropic"))
      .status,
  ).toBe(403);
});

it("rejects API keys even when they belong to an instance administrator", async () => {
  const ctx = await setup();
  const { key } = await auth.api.createApiKey({
    body: { userId: ctx.user.id, name: "Agent model settings test" },
  });
  const response = await ctx.app.request("/api/admin/agent/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ policy: { model: sonnet, models: [sonnet] } }),
  });
  expect(response.status).toBe(403);
});

it("rejects missing defaults, duplicate models, and unconfigured providers", async () => {
  const ctx = await setup();
  expect((await ctx.patch({ model: sonnet, models: [haiku] })).status).toBe(
    400,
  );
  expect(
    (await ctx.patch({ model: sonnet, models: [sonnet, sonnet] })).status,
  ).toBe(400);
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY_FILE", "");
  expect(
    (
      await ctx.patch({
        model: "openai:gpt-6-luna",
        models: ["openai:gpt-6-luna"],
      })
    ).status,
  ).toBe(400);
});

it("restores environment defaults and invalidates the active policy cache", async () => {
  const ctx = await setup();
  await ctx.patch({ model: haiku, models: [haiku] });
  expect((await requireEffectiveAgentConfig()).model).toBe(haiku);
  const restored = await ctx.patch(null);
  expect(restored.status).toBe(200);
  expect(await restored.json()).toMatchObject({
    managed: false,
    model: sonnet,
  });
  expect((await requireEffectiveAgentConfig()).model).toBe(sonnet);
});

it("rejects removed models for both new and already queued runs without provider calls", async () => {
  const ctx = await setup();
  await ctx.patch({ model: haiku, models: [sonnet, haiku] });
  const conversation = await (await ctx.post("/conversations", {})).json();
  const created = await ctx.post(`/conversations/${conversation.id}/runs`, {
    requestId: randomUUID(),
    prompt: "Hello",
    model: sonnet,
  });
  const { id } = await created.json();
  await ctx.patch({ model: haiku, models: [haiku] });
  expect(
    (
      await ctx.post(`/conversations/${conversation.id}/runs`, {
        requestId: randomUUID(),
        prompt: "Hello",
        model: sonnet,
      })
    ).status,
  ).toBe(400);
  const lease = randomUUID();
  const [run] = await db
    .update(schema.agentRunTable)
    .set({
      status: "running",
      leaseOwner: lease,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .where(eq(schema.agentRunTable.id, id))
    .returning();
  const [row] = await db
    .select()
    .from(schema.agentConversationTable)
    .where(eq(schema.agentConversationTable.id, conversation.id));
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await executeAgentRun(
    run!,
    row!,
    await requireEffectiveAgentConfig(),
    lease,
    new AbortController().signal,
  );
  expect(fetch).not.toHaveBeenCalled();
  const [failed] = await db
    .select()
    .from(schema.agentRunTable)
    .where(eq(schema.agentRunTable.id, id));
  expect(failed?.status).toBe("failed");
});

it("lists connected-provider models without returning keys or upstream errors", async () => {
  const ctx = await setup();
  const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) =>
    Response.json({
      data: [{ id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5" }],
      has_more: false,
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const response = await ctx.app.request(
    "/api/admin/agent/models?provider=anthropic",
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    supported: true,
    models: [{ id: sonnet, label: "Claude Sonnet 5.5" }],
  });
  expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("x-api-key")).toBe(
    "synthetic-admin-model-key",
  );
  fetch.mockResolvedValueOnce(
    Response.json(
      { error: { message: "synthetic-admin-model-key private-path" } },
      { status: 401 },
    ),
  );
  const failed = await ctx.app.request(
    "/api/admin/agent/models?provider=anthropic",
  );
  expect(failed.status).toBe(502);
  expect(await failed.text()).not.toContain("synthetic-admin-model-key");
});
