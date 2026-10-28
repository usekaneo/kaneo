import { randomUUID } from "node:crypto";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import db, { schema } from "../../../apps/api/src/database";
import { saveAutomation } from "../../../apps/api/src/agent/automation/controllers/save";
import { createAutomationSchema } from "../../../apps/api/src/agent/automation/schema";
import { runAutomationNow } from "../../../apps/api/src/agent/automation/controllers/run-now";
import { executeAgentRun } from "../../../apps/api/src/agent/runner";
import { requireAgentConfig } from "../../../apps/api/src/agent/config";
import { createProjectFixture, createWorkspaceMember } from "./fixtures";

export async function automationFixture(
  overrides: Record<string, unknown> = {},
) {
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Check this",
      columnId: columns.todo.id,
    })
    .returning();
  const subject = {
    userId: user.id,
    workspaceId: workspace.id,
    projectId: null,
  };
  const input = createAutomationSchema.parse({
    name: "Morning review",
    prompt: "Review the work",
    projectId: project.id,
    output: "proposals",
    trigger: {
      type: "schedule",
      frequency: "daily",
      time: "09:00",
      timezone: "Europe/Berlin",
    },
    ...overrides,
  });
  const id = await saveAutomation(subject, input);
  return { user, workspace, project, columns, task, subject, input, id };
}

export function automationModel(fail = false) {
  return new MockLanguageModelV4({
    doStream: async () => {
      if (fail) throw new Error("private upstream failure");
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({ type: "text-start", id: "text" });
            controller.enqueue({
              type: "text-delta",
              id: "text",
              delta: "Two tasks need review.",
            });
            controller.enqueue({ type: "text-end", id: "text" });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
              },
            });
            controller.close();
          },
        }),
      };
    },
  });
}

export async function executeAutomationRun(
  subject: { userId: string; workspaceId: string; projectId: string | null },
  id: string,
  model = automationModel(),
) {
  const queued = await runAutomationNow(subject, id);
  return executeQueuedAutomationRun(queued.id, model);
}

export async function executeQueuedAutomationRun(
  runId: string,
  model = automationModel(),
) {
  const owner = randomUUID();
  const [run] = await db
    .update(schema.agentRunTable)
    .set({
      status: "running",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .where(eq(schema.agentRunTable.id, runId))
    .returning();
  const [conversation] = await db
    .select()
    .from(schema.agentConversationTable)
    .where(eq(schema.agentConversationTable.id, run!.conversationId));
  await executeAgentRun(
    run!,
    conversation!,
    requireAgentConfig(),
    owner,
    new AbortController().signal,
    model,
  );
  return (
    await db
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, run!.id))
  )[0]!;
}

export async function automationMember(workspaceId: string, role = "admin") {
  const { user } = await createWorkspaceMember({ role });
  await db
    .insert(schema.workspaceUserTable)
    .values({ workspaceId, userId: user.id, role, joinedAt: new Date() });
  return { user };
}
