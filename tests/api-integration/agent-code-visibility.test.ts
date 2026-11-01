import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as access from "../../apps/api/src/agent/access";
import { getRun } from "../../apps/api/src/agent/controllers/get-run";
import { recordTouchedProjects } from "../../apps/api/src/agent/record-touched-projects";
import { createSharedAgentWorkspace } from "./helpers/agent/shared-agent-workspace";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

async function fixture() {
  const ctx = await createSharedAgentWorkspace();
  const conversation = await ctx.conversation();
  const run = await ctx.insertRun(conversation.id, {
    touchedProjectIds: [ctx.alpha.id, ctx.beta.id],
  });
  const job = {
    runId: run.id,
    workspaceId: ctx.workspace.id,
    projectId: ctx.alpha.id,
    taskId: ctx.alphaTask.id,
    userId: ctx.owner.id,
    requestId: randomUUID(),
    instructions: "Fix reconnect",
    model: "openai/gpt-6-luna",
    repositoryOwner: "acme",
    repositoryName: "widget",
    repositoryId: 42,
    branch: "agent/fix",
    deadline: new Date(Date.now() + 60000),
  };
  const [inserted] = await db
    .insert(schema.agentJobTable)
    .values(job)
    .returning();
  if (!inserted) throw new Error("job missing");
  await db
    .insert(schema.agentJobEventTable)
    .values({ jobId: inserted.id, phase: "queued" });
  return { ...ctx, conversation, run, job: inserted, jobInput: job };
}

describe("coding job run visibility", () => {
  it("hides a job and its events when another touched project is restricted", async () => {
    const ctx = await fixture();
    // The job itself is in alpha, which the restricted member can read.
    for (const path of [
      `/jobs/${ctx.job.id}`,
      `/jobs/${ctx.job.id}/events`,
      `/runs/${ctx.run.id}`,
      `/runs/${ctx.run.id}/events`,
    ]) {
      expect(await ctx.status(ctx.restricted, path)).toBe(404);
      expect(await ctx.status(ctx.viewer, path)).toBe(200);
    }
    expect(await ctx.json(ctx.restricted, "/runs")).toEqual([]);
    expect(
      (await ctx.json(ctx.viewer, `/runs/${ctx.run.id}`)).jobs,
    ).toMatchObject([{ id: ctx.job.id }]);
    expect(
      (
        await ctx.json(ctx.viewer, `/conversations/${ctx.conversation.id}/runs`)
      )[0].jobs,
    ).toMatchObject([{ id: ctx.job.id }]);
    expect((await ctx.json(ctx.viewer, "/runs"))[0].jobs).toMatchObject([
      { id: ctx.job.id },
    ]);
    await restrictToProjects(ctx.workspace.id, ctx.viewer.id, [ctx.alpha.id]);
    expect(await ctx.status(ctx.viewer, `/jobs/${ctx.job.id}`)).toBe(404);
    expect(await ctx.status(ctx.viewer, `/jobs/${ctx.job.id}/events`)).toBe(
      404,
    );
    await restrictToProjects(ctx.workspace.id, ctx.viewer.id, [
      ctx.alpha.id,
      ctx.beta.id,
    ]);
    expect(await ctx.status(ctx.viewer, `/jobs/${ctx.job.id}`)).toBe(200);
  });

  it("keeps legacy jobs owner-only even for instance admins and revokes unshared access", async () => {
    const ctx = await fixture();
    await db
      .update(schema.agentRunTable)
      .set({ touchedProjectIds: ["*"] })
      .where(eq(schema.agentRunTable.id, ctx.run.id));
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, ctx.viewer.id));
    for (const path of [`/jobs/${ctx.job.id}`, `/jobs/${ctx.job.id}/events`]) {
      expect(await ctx.status(ctx.viewer, path)).toBe(404);
      expect(await ctx.status(ctx.owner, path)).toBe(200);
    }
    await db
      .update(schema.agentRunTable)
      .set({ touchedProjectIds: [ctx.alpha.id] })
      .where(eq(schema.agentRunTable.id, ctx.run.id));
    await db
      .update(schema.agentConversationTable)
      .set({ sharedAt: null })
      .where(eq(schema.agentConversationTable.id, ctx.conversation.id));
    expect(await ctx.status(ctx.viewer, `/jobs/${ctx.job.id}`)).toBe(404);
  });

  it("reads jobs from the same visibility snapshot as the run", async () => {
    const ctx = await fixture();
    await db
      .update(schema.agentRunTable)
      .set({ touchedProjectIds: [ctx.alpha.id] })
      .where(eq(schema.agentRunTable.id, ctx.run.id));
    const original = access.getVisibleRun;
    vi.spyOn(access, "getVisibleRun").mockImplementationOnce(
      async (...args) => {
        const visible = await original(...args);
        await db.transaction(async (tx) => {
          await recordTouchedProjects(ctx.run.id, [ctx.beta.id], tx);
          await tx.insert(schema.agentJobTable).values({
            ...ctx.jobInput,
            requestId: randomUUID(),
            branch: "agent/private",
            instructions: "Private project context",
          });
        });
        return visible;
      },
    );
    const detail = await getRun(
      {
        userId: ctx.restricted.id,
        workspaceId: ctx.workspace.id,
        projectId: null,
      },
      ctx.run.id,
    );
    expect(detail.jobs.map((job) => job.id)).toEqual([ctx.job.id]);
    expect(await ctx.status(ctx.restricted, `/jobs/${ctx.job.id}`)).toBe(404);
  });
});
