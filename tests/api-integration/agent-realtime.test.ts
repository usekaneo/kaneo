import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import type { NodeWebSocket } from "../../apps/api/node_modules/@hono/node-ws";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { notifyJob } from "../../apps/api/src/agent/code/notify";
import { deliverAgentEffects } from "../../apps/api/src/agent/effects";
import { createProposal } from "../../apps/api/src/agent/controllers/create-proposal";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Socket = NodeWebSocket["wss"]["clients"] extends Set<infer S> ? S : never;
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const nodeWsRequire = createRequire(apiRequire.resolve("@hono/node-ws"));
const WebSocket: new (
  url: string,
  options: { headers: Record<string, string> },
) => Socket = nodeWsRequire("ws").WebSocket;
let server: ReturnType<typeof serve> | undefined;
let socket: Socket | undefined;
afterEach(async () => {
  socket?.terminate();
  await shutdownWebSocketAdapter();
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  vi.unstubAllEnvs();
});

it("delivers reviewed changes and undo to the applying tab through the normal board WebSocket without Redis", async () => {
  await resetTestDatabase();
  vi.stubEnv("REDIS_URL", "");
  vi.stubEnv("REDIS_HOST", "");
  vi.stubEnv("REDIS_SENTINELS", "");
  vi.stubEnv("REDIS_CLUSTER_NODES", "");
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Realtime task",
      priority: "low",
    })
    .returning();
  const [conversation] = await db
    .insert(schema.agentConversationTable)
    .values({
      workspaceId: workspace.id,
      projectId: project.id,
      userId: user.id,
      title: "Realtime",
    })
    .returning();
  const owner = randomUUID();
  const [run] = await db
    .insert(schema.agentRunTable)
    .values({
      conversationId: conversation.id,
      requestId: randomUUID(),
      prompt: "Prioritize",
      model: "test",
      status: "running",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .returning();
  const proposal = await createProposal(
    { userId: user.id, workspaceId: workspace.id, projectId: project.id },
    run.id,
    {
      action: {
        type: "task.update",
        taskId: task.id,
        patch: { priority: "high" },
      },
      reason: "Urgent",
    },
    owner,
  );
  await db
    .update(schema.agentRunTable)
    .set({ status: "awaiting_review" })
    .where(eq(schema.agentRunTable.id, run.id));
  mockAuthenticatedSession(user);
  const created = createApp();
  await initializeWebSocketAdapter();
  server = serve({ fetch: created.app.fetch, hostname: "127.0.0.1", port: 0 });
  created.injectWebSocket(server);
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  socket = new WebSocket(
    `ws://127.0.0.1:${address.port}/api/ws/${project.id}?windowId=agent-review`,
    { headers: { Authorization: "Bearer test-session" } },
  );
  await once(socket, "open");
  const messages: Record<string, unknown>[] = [];
  socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
  async function post(path: string, body?: unknown) {
    return created.app.request(`/api/agent/${workspace.id}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kaneo-Window-Id": "agent-review",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  expect(
    (await post(`/runs/${run.id}/apply`, { proposalIds: [proposal.id] }))
      .status,
  ).toBe(200);
  await deliverAgentEffects();
  await vi.waitFor(() =>
    expect(messages).toContainEqual(
      expect.objectContaining({
        type: "TASK_UPDATED",
        taskId: task.id,
        projectId: project.id,
      }),
    ),
  );
  messages.length = 0;
  expect((await post(`/proposals/${proposal.id}/undo`)).status).toBe(200);
  await deliverAgentEffects();
  await vi.waitFor(() =>
    expect(messages).toContainEqual(
      expect.objectContaining({ type: "TASK_UPDATED", taskId: task.id }),
    ),
  );
  const effects = await db
    .select()
    .from(schema.agentEffectTable)
    .orderBy(schema.agentEffectTable.sequence);
  expect(effects).toHaveLength(2);
  expect(effects.every((effect) => effect.deliveredAt !== null)).toBe(true);
  expect(
    messages.every(
      (message) =>
        !("prompt" in message) &&
        !("response" in message) &&
        !("apiKey" in message),
    ),
  ).toBe(true);
});

it("delivers coding job IDs only to the owner's user socket without Redis", async () => {
  await resetTestDatabase();
  for (const name of [
    "REDIS_URL",
    "REDIS_HOST",
    "REDIS_SENTINELS",
    "REDIS_CLUSTER_NODES",
  ])
    vi.stubEnv(name, "");
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  mockAuthenticatedSession(user);
  const created = createApp();
  await initializeWebSocketAdapter();
  server = serve({ fetch: created.app.fetch, hostname: "127.0.0.1", port: 0 });
  created.injectWebSocket(server);
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  socket = new WebSocket(
    `ws://127.0.0.1:${address.port}/api/ws/user?windowId=code-test`,
    { headers: { Authorization: "Bearer test-session" } },
  );
  await once(socket, "open");
  const messages: Record<string, unknown>[] = [];
  socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
  await notifyJob({
    userId: user.id,
    workspaceId: workspace.id,
    runId: "run-id",
    id: "job-id",
  });
  await vi.waitFor(() =>
    expect(messages).toContainEqual({
      type: "AGENT_JOB_UPDATED",
      workspaceId: workspace.id,
      runId: "run-id",
      jobId: "job-id",
    }),
  );
});
