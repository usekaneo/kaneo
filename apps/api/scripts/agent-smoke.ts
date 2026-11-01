import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import db, { getDatabasePool, schema } from "../src/database";
import { resolveDatabaseConfig } from "../src/database/resolve-database-url";
import { createApp } from "../src/index";
import { processAgentQueue, shutdownAgentWorker } from "../src/agent/worker";
import { deliverAgentEffects } from "../src/agent/effects";
import { requireAgentConfig } from "../src/agent/config";

// This command deliberately uses a real provider, but only synthetic data in
// a local test database. Regular tests never require an OpenRouter key.
const database = resolveDatabaseConfig();
assert(
  ["localhost", "127.0.0.1", "::1"].includes(database.host),
  "Live smoke test requires local PostgreSQL",
);
assert(
  database.database.endsWith("_test"),
  "Live smoke test requires a database ending in _test",
);
assert.equal(
  requireAgentConfig().model,
  "openai/gpt-6-luna",
  "Use Luna for this bounded smoke test",
);
process.env.KANEO_AGENT_MAX_STEPS = "8";
process.env.KANEO_AGENT_MAX_OUTPUT_TOKENS = "1024";
process.env.KANEO_AGENT_TIMEOUT_MS = "60000";
process.env.KANEO_AGENT_CONCURRENCY = "1";
await migrate(db, {
  migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
});

const userId = `agent-smoke-${randomUUID()}`;
const workspaceId = `agent-smoke-${randomUUID()}`;
const token = randomUUID();
let createdUser = false;
try {
  await db.insert(schema.userTable).values({
    id: userId,
    email: `${userId}@example.com`,
    name: "Agent Test User",
    emailVerified: true,
  });
  createdUser = true;
  await db.insert(schema.sessionTable).values({
    id: randomUUID(),
    userId,
    token,
    expiresAt: new Date(Date.now() + 300000),
    updatedAt: new Date(),
  });
  await db.insert(schema.workspaceTable).values({
    id: workspaceId,
    name: "Agent smoke test",
    slug: workspaceId,
    createdAt: new Date(),
  });
  await db
    .insert(schema.workspaceUserTable)
    .values({ userId, workspaceId, role: "admin", joinedAt: new Date() });
  const [project] = await db
    .insert(schema.projectTable)
    .values({
      workspaceId,
      name: "Smoke test",
      slug: `smoke-${randomUUID()}`,
      icon: "Folder",
      lastTaskNumber: 1,
    })
    .returning();
  assert(project);
  const [column] = await db
    .insert(schema.columnTable)
    .values({
      projectId: project.id,
      name: "To do",
      slug: "to-do",
      position: 0,
      isFinal: false,
    })
    .returning();
  assert(column);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: column.id,
      title: "Fix broken sign-in",
      description: "Users cannot sign in. This blocks using the app.",
      priority: "low",
      number: 1,
      status: "to-do",
    })
    .returning();
  assert(task);
  const { app } = createApp();
  const base = `/api/agent/${workspaceId}`;
  async function request(path: string, body?: unknown) {
    const response = await app.request(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert(response.ok, `Agent endpoint returned ${response.status}`);
    return response.json();
  }
  const conversation = await request("/conversations", {
    projectId: project.id,
    title: "Live smoke test",
  });
  const queued = await request(`/conversations/${conversation.id}/runs`, {
    requestId: randomUUID(),
    prompt:
      "Lies die Aufgaben in diesem Projekt. Schlage für die Aufgabe mit der defekten Anmeldung eine hohe Priorität vor. Ändere nichts direkt und halte die Antwort kurz.",
  });
  await processAgentQueue();
  const deadline = Date.now() + 75000;
  let run = await request(`/runs/${queued.id}`);
  while (["queued", "running"].includes(run.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    run = await request(`/runs/${queued.id}`);
  }
  // Only metadata and synthetic tool names are printed, never headers or keys.
  console.log(
    JSON.stringify(
      {
        model: run.model,
        status: run.status,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        costUsd: run.costUsd,
        tools: run.steps.map((step: { toolName: string }) => step.toolName),
        proposals: run.proposals.length,
        error: run.error,
      },
      null,
      2,
    ),
  );
  if (run.status !== "awaiting_review") {
    console.log(
      JSON.stringify(
        {
          response: run.response,
          steps: run.steps.map(
            (step: {
              toolName: string;
              input: unknown;
              summary: string | null;
              status: string;
            }) => ({
              tool: step.toolName,
              input: step.input,
              status: step.status,
              summary: step.summary,
            }),
          ),
        },
        null,
        2,
      ),
    );
  }
  assert.equal(run.status, "awaiting_review", "Expected a reviewable proposal");
  assert.equal(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      })
    )?.priority,
    "low",
  );
  const proposal = run.proposals.find(
    (proposal: {
      action: { type: string; taskId?: string; patch?: { priority?: string } };
    }) =>
      proposal.action.type === "task.update" &&
      proposal.action.taskId === task.id &&
      proposal.action.patch?.priority === "high",
  );
  assert(proposal, "Expected a high-priority task update");
  const applied = await request(`/runs/${queued.id}/apply`, {
    proposalIds: [proposal.id],
  });
  assert.equal(applied.results[0].status, "applied");
  await deliverAgentEffects();
  assert.equal(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      })
    )?.priority,
    "high",
  );
  await request(`/proposals/${proposal.id}/undo`, {});
  await deliverAgentEffects();
  assert.equal(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      })
    )?.priority,
    "low",
  );
  console.log("Live proposal, apply, and undo passed.");
} finally {
  await shutdownAgentWorker();
  await db
    .delete(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId));
  if (createdUser)
    await db.delete(schema.userTable).where(eq(schema.userTable.id, userId));
  await getDatabasePool().end();
}
