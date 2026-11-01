import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { requireAgentConfig } from "../../apps/api/src/agent/config";
import { executeAgentRun } from "../../apps/api/src/agent/runner";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("KANEO_AGENT_MODEL", "anthropic:claude-sonnet-5-5");
  vi.stubEnv("KANEO_AGENT_MODELS", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-anthropic-key");
  vi.stubEnv("OPENROUTER_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup() {
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const base = `/api/agent/${workspace.id}`;
  const post = (path: string, body: unknown) =>
    app.request(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const response = await post("/conversations", {});
  expect(response.status).toBe(201);
  const conversation = await response.json();
  return { app, base, post, conversation };
}

it("exposes mixed-provider model choices without exposing server credentials", async () => {
  vi.stubEnv("KANEO_AGENT_MODELS", "openai:gpt-6-luna");
  vi.stubEnv("OPENAI_API_KEY", "synthetic-openai-key");
  const ctx = await setup();
  const response = await ctx.app.request(`${ctx.base}/config`);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.enabled).toBe(true);
  expect(body.model).toBe("anthropic:claude-sonnet-5-5");
  expect(body.models.map((model: { id: string }) => model.id)).toEqual([
    "anthropic:claude-sonnet-5-5",
    "openai:gpt-6-luna",
  ]);
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("synthetic-");
  expect(serialized).not.toContain("providers");
  const denied = await ctx.post(`/conversations/${ctx.conversation.id}/runs`, {
    requestId: randomUUID(),
    prompt: "Hello",
    model: "openai:unlisted",
  });
  expect(denied.status).toBe(400);
});

it("streams through the real Anthropic adapter and persists the provider-qualified model and usage", async () => {
  const ctx = await setup();
  const response = await ctx.post(
    `/conversations/${ctx.conversation.id}/runs`,
    {
      requestId: randomUUID(),
      prompt: "Say hello",
    },
  );
  expect(response.status).toBe(202);
  const { id } = await response.json();
  const owner = randomUUID();
  const [run] = await db
    .update(schema.agentRunTable)
    .set({
      status: "running",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .where(eq(schema.agentRunTable.id, id))
    .returning();
  const [conversation] = await db
    .select()
    .from(schema.agentConversationTable)
    .where(eq(schema.agentConversationTable.id, ctx.conversation.id));
  const events = [
    {
      type: "message_start",
      message: {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hello from Claude." },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 5 },
    },
    { type: "message_stop" },
  ];
  const fetch = vi.fn(
    async (_input: unknown, _init?: RequestInit) =>
      new Response(
        events
          .map(
            (event) =>
              `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          )
          .join(""),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  await executeAgentRun(
    run!,
    conversation!,
    requireAgentConfig(),
    owner,
    new AbortController().signal,
  );
  const [stored] = await db
    .select()
    .from(schema.agentRunTable)
    .where(eq(schema.agentRunTable.id, id));
  expect(stored).toMatchObject({
    model: "anthropic:claude-sonnet-5-5",
    status: "completed",
    response: "Hello from Claude.",
    inputTokens: 10,
    outputTokens: 5,
    costUsd: null,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
  expect(new Headers(init?.headers).get("x-api-key")).toBe(
    "synthetic-anthropic-key",
  );
  expect(JSON.parse(String(init?.body)).stream).toBe(true);
});
