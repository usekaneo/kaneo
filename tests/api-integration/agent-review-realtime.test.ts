import { randomUUID } from "node:crypto";
import { once, type EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  broadcastToUser,
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { runAutomationNow } from "../../apps/api/src/agent/automation/controllers/run-now";
import { applyProposals } from "../../apps/api/src/agent/controllers/apply-proposals";
import { createProposal } from "../../apps/api/src/agent/controllers/create-proposal";
import { automationFixture } from "./helpers/agent-automation";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

type Socket = EventEmitter & { terminate(): void };
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const nodeWsRequire = createRequire(apiRequire.resolve("@hono/node-ws"));
const WebSocket: new (
  url: string,
  options: { headers: Record<string, string> },
) => Socket = nodeWsRequire("ws").WebSocket;
let server: ReturnType<typeof serve> | undefined;
const sockets: Socket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await shutdownWebSocketAdapter();
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
  }
  vi.unstubAllEnvs();
});

it.each(["apply", "discard", "undo"] as const)(
  "notifies both owner sessions of committed %s and idempotent retries, without exposing private run IDs to other members",
  async (action) => {
    await resetTestDatabase();
    for (const name of [
      "REDIS_URL",
      "REDIS_HOST",
      "REDIS_SENTINELS",
      "REDIS_CLUSTER_NODES",
    ])
      vi.stubEnv(name, "");
    vi.stubEnv("KANEO_AGENT_ENABLED", "true");
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-only-no-inference");
    const ctx = await automationFixture();
    await db
      .update(schema.taskTable)
      .set({ priority: "low" })
      .where(eq(schema.taskTable.id, ctx.task.id));
    const queued = await runAutomationNow(ctx.subject, ctx.id);
    const owner = randomUUID();
    const [run] = await db
      .update(schema.agentRunTable)
      .set({
        status: "running",
        leaseOwner: owner,
        leaseExpiresAt: new Date(Date.now() + 60000),
      })
      .where(eq(schema.agentRunTable.id, queued.id))
      .returning();
    const proposal = await createProposal(
      ctx.subject,
      run!.id,
      {
        action: {
          type: "task.update",
          taskId: ctx.task.id,
          patch: { priority: "high" },
        },
        reason: "Private review fixture",
      },
      owner,
    );
    await db
      .update(schema.agentRunTable)
      .set({ status: "awaiting_review" })
      .where(eq(schema.agentRunTable.id, run!.id));
    if (action === "undo")
      await applyProposals(ctx.subject, run!.id, [proposal.id]);
    const other = await createWorkspaceMember({ role: "admin" });
    await db.insert(schema.workspaceUserTable).values({
      userId: other.user.id,
      workspaceId: ctx.workspace.id,
      role: "admin",
      joinedAt: new Date(),
    });
    const created = createApp();
    await initializeWebSocketAdapter();
    server = serve({
      fetch: created.app.fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    created.injectWebSocket(server);
    if (!server.listening) await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No test port");
    const received: Record<string, unknown>[][] = [[], [], []];
    const states: Promise<{
      status: string;
      runStatus: string;
      priority: string;
    }>[][] = [[], []];
    for (let index = 0; index < 3; index++) {
      mockAuthenticatedSession(index === 2 ? other.user : ctx.user);
      const socket = new WebSocket(
        `ws://127.0.0.1:${address.port}/api/ws/user?windowId=review-${index}`,
        {
          headers: { Authorization: "Bearer fixture-session" },
        },
      );
      sockets.push(socket);
      await once(socket, "open");
      socket.on("message", (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === "WORKSPACE_ACCESS_SYNC") return;
        received[index]!.push(message);
        if (index < 2 && message.type === "AGENT_RUN_UPDATED")
          states[index]!.push(
            (async () => {
              const saved = await db.query.agentProposalTable.findFirst({
                where: eq(schema.agentProposalTable.id, proposal.id),
              });
              const savedRun = await db.query.agentRunTable.findFirst({
                where: eq(schema.agentRunTable.id, run!.id),
              });
              const task = await db.query.taskTable.findFirst({
                where: eq(schema.taskTable.id, ctx.task.id),
              });
              return {
                status: saved!.status,
                runStatus: savedRun!.status,
                priority: task!.priority,
              };
            })(),
          );
      });
    }
    mockAuthenticatedSession(ctx.user);
    const post = (path: string, body?: unknown) =>
      created.app.request(`/api/agent/${ctx.workspace.id}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Kaneo-Window-Id": "review-0",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const mutate = () =>
      action === "undo"
        ? post(`/proposals/${proposal.id}/undo`)
        : post(`/runs/${run!.id}/${action}`, { proposalIds: [proposal.id] });
    expect(
      (await post(`/runs/${run!.id}/discard`, { proposalIds: ["missing"] }))
        .status,
    ).toBe(404);
    for (let attempt = 1; attempt <= 2; attempt++) {
      expect((await mutate()).status).toBe(200);
      await vi.waitFor(() => {
        expect(received[0]).toHaveLength(attempt);
        expect(received[1]).toHaveLength(attempt);
      });
      for (const index of [0, 1]) {
        expect(received[index]![attempt - 1]).toEqual({
          type: "AGENT_RUN_UPDATED",
          workspaceId: ctx.workspace.id,
          runId: run!.id,
          conversationId: run!.conversationId,
        });
        expect(await states[index]![attempt - 1]).toEqual({
          status:
            action === "apply"
              ? "applied"
              : action === "discard"
                ? "discarded"
                : "undone",
          runStatus: "completed",
          priority: action === "apply" ? "high" : "low",
        });
      }
    }
    // A later frame is a delivery barrier for the other member's socket.
    broadcastToUser(other.user.id, { type: "NOTIFICATION_CREATED" });
    await vi.waitFor(() =>
      expect(received[2]).toContainEqual({ type: "NOTIFICATION_CREATED" }),
    );
    expect(received[2]).toEqual([{ type: "NOTIFICATION_CREATED" }]);
    expect((await db.select().from(schema.agentEffectTable)).length).toBe(
      action === "apply" ? 1 : action === "undo" ? 2 : 0,
    );
  },
);
