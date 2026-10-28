import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { User } from "better-auth/types";
import db, { schema } from "../../../../apps/api/src/database";
import { createApp } from "../../../../apps/api/src/index";
import { requireAgentConfig } from "../../../../apps/api/src/agent/config";
import { executeAgentRun } from "../../../../apps/api/src/agent/runner";
import { mockAuthenticatedSession } from "../auth";
import { addWorkspaceMember } from "../project-access/add-workspace-member";
import { createRestrictedWorkspace } from "../project-access/create-restricted-workspace";
import { scriptedModel } from "./scripted-model";

// The workspace owner starts conversations; `viewer` can read every project,
// `restricted` only alpha.
export async function createSharedAgentWorkspace() {
  const ctx = await createRestrictedWorkspace();
  const viewer = await addWorkspaceMember(ctx.workspace.id);
  const { app } = createApp();
  const base = `/api/agent/${ctx.workspace.id}`;

  async function conversation(projectId: string | null = null) {
    const [row] = await db
      .insert(schema.agentConversationTable)
      .values({
        userId: ctx.owner.id,
        workspaceId: ctx.workspace.id,
        projectId,
        title: "Plan",
        sharedAt: new Date(),
      })
      .returning();
    if (!row) throw new Error("conversation not created");
    return row;
  }

  async function insertRun(
    conversationId: string,
    values: Partial<typeof schema.agentRunTable.$inferInsert> = {},
  ) {
    const [run] = await db
      .insert(schema.agentRunTable)
      .values({
        conversationId,
        requestId: randomUUID(),
        prompt: "Plan the week",
        model: "openai/gpt-6-luna",
        status: "completed",
        ...values,
      })
      .returning();
    if (!run) throw new Error("run not created");
    return run;
  }

  // Executes a run through the real runner and tools with a scripted model.
  async function execute(
    target: typeof schema.agentConversationTable.$inferSelect,
    calls: Array<{ toolName: string; input: unknown }>,
    prompt = "Plan the week",
  ) {
    const lease = randomUUID();
    const run = await insertRun(target.id, {
      prompt,
      status: "running",
      leaseOwner: lease,
      leaseExpiresAt: new Date(Date.now() + 60000),
    });
    await executeAgentRun(
      run,
      target,
      requireAgentConfig(),
      lease,
      new AbortController().signal,
      scriptedModel(calls),
    );
    const [finished] = await db
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, run.id));
    if (!finished) throw new Error("run missing");
    if (!["completed", "awaiting_review"].includes(finished.status))
      throw new Error(`Run ${finished.status}: ${finished.error}`);
    return finished;
  }

  async function status(user: User, path: string) {
    mockAuthenticatedSession(user);
    return (await app.request(`${base}${path}`)).status;
  }

  async function json(user: User, path: string) {
    mockAuthenticatedSession(user);
    const response = await app.request(`${base}${path}`);
    if (response.status !== 200)
      throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  return { ...ctx, viewer, conversation, insertRun, execute, status, json };
}
