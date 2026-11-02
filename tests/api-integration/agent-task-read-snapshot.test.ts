import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { eq } from "drizzle-orm";
import { stepCountIs, streamText } from "ai";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  assertAgentProject,
  getVisibleRun,
} from "../../apps/api/src/agent/access";
import { createAgentTools } from "../../apps/api/src/agent/tools";
import { resetTestDatabase } from "./helpers/database";
import { scriptedModel } from "./helpers/agent/scripted-model";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

it("keeps newly private comments out of the model when a task moves between detail queries", async () => {
  const ctx = await createRestrictedWorkspace();
  const viewer = await addWorkspaceMember(ctx.workspace.id);
  await restrictToProjects(ctx.workspace.id, viewer.id, [ctx.alpha.id]);
  const subject = {
    userId: ctx.restricted.id,
    workspaceId: ctx.workspace.id,
    projectId: null,
  };
  await expect(assertAgentProject(subject, ctx.beta.id)).rejects.toMatchObject({
    status: 404,
  });
  const [conversation] = await db
    .insert(schema.agentConversationTable)
    .values({
      workspaceId: ctx.workspace.id,
      userId: ctx.restricted.id,
      title: "Task details",
      sharedAt: new Date(),
    })
    .returning();
  const lease = randomUUID();
  const [run] = await db
    .insert(schema.agentRunTable)
    .values({
      conversationId: conversation!.id,
      requestId: randomUUID(),
      prompt: "Read task",
      model: "openai/test",
      status: "running",
      leaseOwner: lease,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .returning();
  const [column] = await db
    .select()
    .from(schema.columnTable)
    .where(eq(schema.columnTable.projectId, ctx.beta.id))
    .limit(1);
  const privateComment =
    "Comment created only after the task moved to restricted Beta";
  let moved = false;
  const move = async () => {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.taskTable)
        .set({
          projectId: ctx.beta.id,
          columnId: column!.id,
          status: column!.slug,
          number: 777,
        })
        .where(eq(schema.taskTable.id, ctx.alphaTask.id));
      await tx.insert(schema.activityTable).values({
        taskId: ctx.alphaTask.id,
        userId: ctx.owner.id,
        type: "comment",
        content: privateComment,
      });
    });
  };
  const original = Client.prototype.query;
  // Execute a real competing transaction immediately before the comment SELECT.
  // Support both Pool.query callbacks and transaction-client promises so this
  // regression also fails against the former non-transactional implementation.
  const intercept = function (this: Client, ...args: unknown[]) {
    const request = args[0];
    const text =
      typeof request === "string"
        ? request
        : request && typeof request === "object" && "text" in request
          ? String(request.text)
          : "";
    if (
      !moved &&
      text.startsWith("select ") &&
      text.includes('from "activity"')
    ) {
      moved = true;
      const callback = args.at(-1);
      if (typeof callback === "function") {
        void move().then(
          () => Reflect.apply(original, this, args),
          (error: unknown) => callback(error),
        );
        return;
      }
      return move().then(() => Reflect.apply(original, this, args));
    }
    return Reflect.apply(original, this, args);
  };
  vi.spyOn(Client.prototype, "query").mockImplementation(
    intercept as typeof original,
  );
  const model = scriptedModel([
    { toolName: "get_task", input: { taskId: ctx.alphaTask.id } },
  ]);
  const result = streamText({
    model,
    tools: createAgentTools(
      subject,
      run!.id,
      lease,
      new AbortController().signal,
      () => {},
    ),
    messages: [{ role: "user", content: "Read task details" }],
    stopWhen: stepCountIs(3),
  });
  await result.text;
  expect(moved).toBe(true);
  expect(model.doStreamCalls).toHaveLength(2);
  expect(JSON.stringify(model.doStreamCalls[1]!.prompt)).not.toContain(
    privateComment,
  );
  const [stored] = await db
    .select()
    .from(schema.agentRunTable)
    .where(eq(schema.agentRunTable.id, run!.id));
  expect(stored!.touchedProjectIds).toEqual([ctx.alpha.id]);
  expect(
    (
      await db
        .select()
        .from(schema.activityTable)
        .where(eq(schema.activityTable.taskId, ctx.alphaTask.id))
    ).some((comment) => comment.content === privateComment),
  ).toBe(true);
  await expect(assertAgentProject(subject, ctx.beta.id)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (await getVisibleRun({ ...subject, userId: viewer.id }, run!.id)).run.id,
  ).toBe(run!.id);
});
