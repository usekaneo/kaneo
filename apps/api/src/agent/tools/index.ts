import { tool } from "ai";
import { and, count, eq, gt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import db, { schema } from "../../database";
import { assertAgentAccess } from "../access";
import { createProposal } from "../controllers/create-proposal";
import { recordTouchedProjects } from "../record-touched-projects";
import { createProposalSchema } from "../schema";
import {
  projectsInTaskPage,
  splitWorkload,
  uniqueProjectIds,
} from "../touched-project-ids";
import type { AgentSubject } from "../types";
import { summarizeToolResult } from "./summarize-result";
import {
  readMembers,
  readProjects,
  readTask,
  readTasks,
  readWorkload,
} from "./read-tools";

export function createAgentTools(
  subject: AgentSubject,
  runId: string,
  leaseOwner: string,
  signal: AbortSignal,
  notify: () => void,
) {
  let resultCharacters = 0;
  async function execute<T>(
    name: string,
    toolCallId: string,
    input: unknown,
    read: () => Promise<{ result: T; projectIds: string[] }>,
  ) {
    signal.throwIfAborted();
    await assertAgentAccess(subject);
    const step = await db.transaction(async (tx) => {
      const [run] = await tx
        .select({ id: schema.agentRunTable.id })
        .from(schema.agentRunTable)
        .where(
          and(
            eq(schema.agentRunTable.id, runId),
            eq(schema.agentRunTable.status, "running"),
            eq(schema.agentRunTable.leaseOwner, leaseOwner),
            gt(schema.agentRunTable.leaseExpiresAt, new Date()),
          ),
        )
        .for("update");
      if (!run)
        throw new HTTPException(409, { message: "Run is no longer active" });
      const [total] = await tx
        .select({ value: count() })
        .from(schema.agentStepTable)
        .where(eq(schema.agentStepTable.runId, runId));
      if ((total?.value ?? 0) >= 30 || resultCharacters >= 100000)
        throw new HTTPException(400, {
          message: "Agent tool budget exhausted",
        });
      const [step] = await tx
        .insert(schema.agentStepTable)
        .values({ runId, toolCallId, toolName: name, input })
        .returning();
      if (!step)
        throw new HTTPException(500, {
          message: "Could not record tool execution",
        });
      return step;
    });
    notify();
    try {
      const { result, projectIds } = await read();
      signal.throwIfAborted();
      resultCharacters += JSON.stringify(result).length;
      if (resultCharacters > 100000)
        throw new HTTPException(400, {
          message: "Agent tool result budget exhausted",
        });
      await db.transaction(async (tx) => {
        await recordTouchedProjects(runId, projectIds, tx);
        await tx
          .update(schema.agentStepTable)
          .set({
            status: "completed",
            summary: summarizeToolResult(name, result),
            finishedAt: new Date(),
          })
          .where(eq(schema.agentStepTable.id, step.id));
      });
      notify();
      return result;
    } catch (error) {
      const message =
        error instanceof HTTPException
          ? error.message
          : "Tool could not complete";
      await db
        .update(schema.agentStepTable)
        .set({ status: "failed", summary: message, finishedAt: new Date() })
        .where(eq(schema.agentStepTable.id, step.id));
      notify();
      if (signal.aborted) throw error;
      return { error: message };
    }
  }
  const projectId = z
    .string()
    .min(1)
    .max(128)
    .nullable()
    .optional()
    .describe(
      "An actual project ID from list_projects, or null for the current conversation scope. Never use 'all'.",
    );
  return {
    list_projects: tool({
      description: "List up to 100 projects in the current scope.",
      inputSchema: z.object({}).strict(),
      execute: (input, options) =>
        execute("list_projects", options.toolCallId, input, async () => {
          const projects = await readProjects(subject);
          return {
            result: projects,
            projectIds: uniqueProjectIds(projects.map((project) => project.id)),
          };
        }),
    }),
    list_members: tool({
      description:
        "List up to 100 workspace members, with IDs and names. Does not establish availability or skill.",
      inputSchema: z.object({}).strict(),
      execute: (input, options) =>
        execute("list_members", options.toolCallId, input, async () => ({
          result: await readMembers(subject),
          projectIds: [],
        })),
    }),
    list_tasks: tool({
      description:
        "List tasks without title, status, or assignee filters. Inspect returned titles to find relevant tasks, including synonyms or translations. Continue with nextOffset to inspect further pages; do not claim complete coverage before reaching the end.",
      inputSchema: z
        .object({
          projectId,
          limit: z.number().int().min(1).max(50).default(30),
          offset: z.number().int().min(0).max(10000).default(0),
        })
        .strict(),
      execute: (input, options) =>
        execute("list_tasks", options.toolCallId, input, async () => {
          const page = await readTasks(subject, input);
          return {
            result: page,
            projectIds: projectsInTaskPage(
              input.projectId ?? subject.projectId,
              page,
            ),
          };
        }),
    }),
    get_task: tool({
      description:
        "Read a task with bounded description, 10 recent comments, stored external link titles and URLs, and project columns. Links are not live PR reviews or CI results.",
      inputSchema: z.object({ taskId: z.string().min(1).max(128) }).strict(),
      execute: (input, options) =>
        execute("get_task", options.toolCallId, input, async () => {
          const task = await readTask(subject, input.taskId);
          return { result: task, projectIds: [task.projectId] };
        }),
    }),
    workload: tool({
      description:
        "Calculate open task counts by assignee, including overdue tasks and tasks due in [from,to). Counts are not capacity estimates.",
      inputSchema: z
        .object({
          projectId,
          from: z.string().datetime({ offset: true }),
          to: z.string().datetime({ offset: true }),
        })
        .strict()
        .refine(
          (value) => Date.parse(value.from) < Date.parse(value.to),
          "from must precede to",
        ),
      execute: (input, options) =>
        execute("workload", options.toolCallId, input, async () =>
          splitWorkload(
            input.projectId ?? subject.projectId,
            await readWorkload(subject, input),
          ),
        ),
    }),
    propose_change: tool({
      description:
        'Save a concrete task creation, task update, or task comment for user review. This never applies a change or posts anything; the user reviews and applies it. Use actual IDs from read tools. Task updates support title, priority, assignee, and due date; task creation uses an existing project column slug. Propose a comment (comment.create) when the user asks to nudge, ask, or update teammates on a task; it is posted as the user, so write it in their voice. The body is Markdown; mention a member with <kaneo-mention id="USER_ID" label="Name"></kaneo-mention> using an ID from list_members, which notifies them.',
      inputSchema: createProposalSchema,
      execute: (input, options) =>
        // createProposal records the task's project in its own transaction.
        execute("propose_change", options.toolCallId, input, async () => ({
          result: await createProposal(subject, runId, input, leaseOwner),
          projectIds: [],
        })),
    }),
  };
}
