import { createId } from "@paralleldrive/cuid2";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { requireWorkspaceEntitlement } from "../../billing/controllers/require-entitlement";
import type { AgentDatabase } from "../access";
import { recordTouchedProjects } from "../record-touched-projects";
import { codeActionSchema } from "../schema";
import { taskSnapshot } from "../snapshot";
import type { AgentAction, AgentSubject } from "../types";
import { codeJobBranchName } from "./branch-name";
import { getCodeJobsConfig } from "./config";
import { publicJob } from "./job-response";
import { ACTIVE_CODE_JOB_STATUSES } from "./lifecycle";
import { notifyJob } from "./notify";
import { codeRepository } from "./repository";

export type CodeAction = Extract<AgentAction, { type: "code.run" }>;

export async function insertCodeJob(
  database: AgentDatabase,
  subject: AgentSubject,
  runId: string,
  proposalId: string,
  requestId: string,
  action: CodeAction,
) {
  const { task, repository, config } = await codeRepository(
    subject,
    action.taskId,
    action.integrationId,
    database,
  );
  const run = await database.query.agentRunTable.findFirst({
    where: eq(schema.agentRunTable.id, runId),
  });
  if (!run || run.trigger)
    throw new HTTPException(403, {
      message: "Automations cannot start coding jobs",
    });
  // The task may have moved since the proposal was recorded.
  await recordTouchedProjects(runId, [task.projectId], database);
  await requireWorkspaceEntitlement(subject.workspaceId);
  // Serialize limits across users and instances; no Redis is required.
  await database
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, subject.workspaceId))
    .for("update");
  const jobs = schema.agentJobTable;
  const [active] = await database
    .select({ value: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.workspaceId, subject.workspaceId),
        inArray(jobs.status, ACTIVE_CODE_JOB_STATUSES),
      ),
    );
  const [userActive] = await database
    .select({ value: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.workspaceId, subject.workspaceId),
        eq(jobs.userId, subject.userId),
        inArray(jobs.status, ACTIVE_CODE_JOB_STATUSES),
      ),
    );
  const [recent] = await database
    .select({ value: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.workspaceId, subject.workspaceId),
        eq(jobs.userId, subject.userId),
        gt(jobs.createdAt, new Date(Date.now() - 3600000)),
      ),
    );
  if (
    (active?.value ?? 0) >= 2 ||
    (userActive?.value ?? 0) >= 1 ||
    (recent?.value ?? 0) >= 10
  )
    throw new HTTPException(429, { message: "Coding job limit reached" });
  const project = await database.query.projectTable.findFirst({
    where: eq(schema.projectTable.id, task.projectId),
  });
  if (!project) throw new HTTPException(404, { message: "Project not found" });
  const id = createId();
  const settings = getCodeJobsConfig()!;
  const [job] = await database
    .insert(jobs)
    .values({
      id,
      runId,
      proposalId,
      requestId,
      workspaceId: subject.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      userId: subject.userId,
      integrationId: action.integrationId,
      instructions: action.instructions,
      model: settings.model,
      repositoryOwner: repository.owner.login,
      repositoryName: repository.name,
      repositoryId: repository.id,
      baseRef: action.baseRef ?? repository.default_branch,
      branch: codeJobBranchName(config, project.slug, task, id),
      deadline: new Date(Date.now() + settings.jobTimeoutMinutes * 60000),
    })
    .returning();
  if (!job)
    throw new HTTPException(500, { message: "Could not create coding job" });
  await database
    .insert(schema.agentJobEventTable)
    .values({ jobId: id, phase: "queued" });
  await database
    .update(schema.agentProposalTable)
    .set({
      status: "applied",
      appliedAt: new Date(),
      after: { ...taskSnapshot(task), jobId: id },
    })
    .where(eq(schema.agentProposalTable.id, proposalId));
  return job;
}

export async function startCodeJob(
  subject: AgentSubject,
  input: Omit<CodeAction, "type"> & { requestId: string },
) {
  const { requestId: _requestId, ...fields } = input;
  const action = codeActionSchema.parse({ ...fields, type: "code.run" });
  const job = await db.transaction(async (tx) => {
    await codeRepository(subject, action.taskId, action.integrationId, tx);
    await tx
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, subject.workspaceId))
      .for("update");
    const existing = await tx.query.agentJobTable.findFirst({
      where: and(
        eq(schema.agentJobTable.workspaceId, subject.workspaceId),
        eq(schema.agentJobTable.userId, subject.userId),
        eq(schema.agentJobTable.requestId, input.requestId),
      ),
    });
    if (existing) {
      if (
        existing.taskId !== action.taskId ||
        existing.integrationId !== action.integrationId ||
        existing.instructions !== action.instructions ||
        (action.baseRef && existing.baseRef !== action.baseRef)
      )
        throw new HTTPException(409, { message: "Request ID conflicts" });
      return existing;
    }
    const task = await tx.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, action.taskId),
    });
    if (!task) throw new HTTPException(404, { message: "Task not found" });
    const [conversation] = await tx
      .insert(schema.agentConversationTable)
      .values({
        workspaceId: subject.workspaceId,
        userId: subject.userId,
        projectId: task.projectId,
        title: task.title.slice(0, 200),
      })
      .returning();
    const [run] = await tx
      .insert(schema.agentRunTable)
      .values({
        conversationId: conversation!.id,
        touchedProjectIds: [task.projectId],
        requestId: input.requestId,
        prompt: action.instructions,
        status: "completed",
        model: getCodeJobsConfig()!.model,
        finishedAt: new Date(),
      })
      .returning();
    const [proposal] = await tx
      .insert(schema.agentProposalTable)
      .values({
        runId: run!.id,
        action,
        reason: "Requested from task",
        before: taskSnapshot(task),
      })
      .returning();
    return insertCodeJob(
      tx,
      subject,
      run!.id,
      proposal!.id,
      input.requestId,
      action,
    );
  });
  await notifyJob(job);
  return publicJob(job);
}
