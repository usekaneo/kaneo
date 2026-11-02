import { and, asc, desc, eq, gte, ilike, lt, sql } from "drizzle-orm";
import db, { schema } from "../../database";
import { HTTPException } from "hono/http-exception";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { escapeLikePattern } from "../../search/like-pattern";
import { boundedTaskRead } from "../../task/bounded-read";
import { assertAgentProject } from "../access";
import type { AgentSubject } from "../types";

export async function readProjects(subject: AgentSubject) {
  return db
    .select({
      id: schema.projectTable.id,
      name: schema.projectTable.name,
      slug: schema.projectTable.slug,
    })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, subject.workspaceId),
        projectAccessCondition(subject.userId, schema.projectTable.id),
        subject.projectId
          ? eq(schema.projectTable.id, subject.projectId)
          : undefined,
      ),
    )
    .orderBy(schema.projectTable.name, schema.projectTable.id)
    .limit(100);
}

export async function readMembers(subject: AgentSubject) {
  return db
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .innerJoin(
      schema.userTable,
      eq(schema.workspaceUserTable.userId, schema.userTable.id),
    )
    .where(eq(schema.workspaceUserTable.workspaceId, subject.workspaceId))
    .orderBy(schema.userTable.name, schema.userTable.id)
    .limit(100);
}

// The key users see on cards (e.g. WEB-12), so answers can cite tasks
// without exposing internal IDs.
const taskKey = sql<
  string | null
>`case when ${schema.taskTable.number} is null then null else ${schema.projectTable.slug} || '-' || ${schema.taskTable.number} end`;

export async function readTasks(
  subject: AgentSubject,
  input: {
    projectId?: string | null;
    query?: string;
    status?: string;
    userId?: string;
    limit: number;
    offset: number;
  },
) {
  const projectId = input.projectId ?? subject.projectId;
  if (projectId) await assertAgentProject(subject, projectId);
  return boundedTaskRead(async (tx) => {
    const rows = await tx
      .select({
        id: schema.taskTable.id,
        projectId: schema.taskTable.projectId,
        title: schema.taskTable.title,
        number: schema.taskTable.number,
        key: taskKey,
        status: schema.taskTable.status,
        priority: schema.taskTable.priority,
        userId: schema.taskTable.userId,
        dueDate: schema.taskTable.dueDate,
        updatedAt: schema.taskTable.updatedAt,
      })
      .from(schema.taskTable)
      .innerJoin(
        schema.projectTable,
        eq(schema.taskTable.projectId, schema.projectTable.id),
      )
      .where(
        and(
          eq(schema.projectTable.workspaceId, subject.workspaceId),
          projectAccessCondition(subject.userId, schema.projectTable.id),
          projectId ? eq(schema.taskTable.projectId, projectId) : undefined,
          input.query
            ? ilike(
                schema.taskTable.title,
                `%${escapeLikePattern(input.query)}%`,
              )
            : undefined,
          input.status ? eq(schema.taskTable.status, input.status) : undefined,
          input.userId ? eq(schema.taskTable.userId, input.userId) : undefined,
        ),
      )
      .orderBy(asc(schema.taskTable.id))
      .limit(input.limit + 1)
      .offset(input.offset);
    return {
      tasks: rows.slice(0, input.limit),
      nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
    };
  }, "Agent task query timed out");
}

export async function readTask(subject: AgentSubject, taskId: string) {
  return boundedTaskRead(async (tx) => {
    // The ownership lookup avoids loading arbitrarily large descriptions.
    const [task] = await tx
      .select({
        id: schema.taskTable.id,
        projectId: schema.taskTable.projectId,
        title: schema.taskTable.title,
        number: schema.taskTable.number,
        key: taskKey,
        status: schema.taskTable.status,
        priority: schema.taskTable.priority,
        userId: schema.taskTable.userId,
        dueDate: schema.taskTable.dueDate,
        description: sql<
          string | null
        >`left(${schema.taskTable.description}, 8000)`,
        descriptionTruncated: sql<boolean>`coalesce(length(${schema.taskTable.description}), 0) > 8000`,
      })
      .from(schema.taskTable)
      .innerJoin(
        schema.projectTable,
        eq(schema.taskTable.projectId, schema.projectTable.id),
      )
      .where(
        and(
          eq(schema.taskTable.id, taskId),
          eq(schema.projectTable.workspaceId, subject.workspaceId),
          projectAccessCondition(subject.userId, schema.projectTable.id),
          subject.projectId
            ? eq(schema.taskTable.projectId, subject.projectId)
            : undefined,
        ),
      )
      .limit(1);
    if (!task) {
      throw new HTTPException(404, {
        message: "Task not found in agent scope",
      });
    }
    const [comments, links, columns] = await Promise.all([
      tx
        .select({
          id: schema.activityTable.id,
          userId: schema.activityTable.userId,
          content: sql<
            string | null
          >`left(${schema.activityTable.content}, 2000)`,
          createdAt: schema.activityTable.createdAt,
        })
        .from(schema.activityTable)
        .where(
          and(
            eq(schema.activityTable.taskId, taskId),
            eq(schema.activityTable.type, "comment"),
          ),
        )
        .orderBy(
          desc(schema.activityTable.createdAt),
          desc(schema.activityTable.id),
        )
        .limit(10),
      tx
        .select({
          url: schema.externalLinkTable.url,
          resourceType: schema.externalLinkTable.resourceType,
          title: schema.externalLinkTable.title,
        })
        .from(schema.externalLinkTable)
        .where(eq(schema.externalLinkTable.taskId, taskId))
        .limit(10),
      tx
        .select({
          id: schema.columnTable.id,
          name: schema.columnTable.name,
          slug: schema.columnTable.slug,
          isFinal: schema.columnTable.isFinal,
        })
        .from(schema.columnTable)
        .where(eq(schema.columnTable.projectId, task.projectId))
        .orderBy(schema.columnTable.position)
        .limit(50),
    ]);
    return { ...task, comments, links, columns };
  }, "Agent task details query timed out");
}

export async function readWorkload(
  subject: AgentSubject,
  input: { projectId?: string | null; from: string; to: string },
) {
  const projectId = input.projectId ?? subject.projectId;
  if (projectId) await assertAgentProject(subject, projectId);
  return boundedTaskRead(
    (tx) =>
      tx
        .select({
          userId: schema.taskTable.userId,
          openTasks: sql<number>`count(*)::integer`,
          dueInPeriod: sql<number>`count(*) filter (where ${gte(schema.taskTable.dueDate, new Date(input.from))} and ${lt(schema.taskTable.dueDate, new Date(input.to))})::integer`,
          overdueTasks: sql<number>`count(*) filter (where ${schema.taskTable.dueDate} < now())::integer`,
          // Recorded as touched projects; not sent to the model.
          projectIds: sql<
            string[]
          >`array_agg(distinct ${schema.taskTable.projectId})`,
        })
        .from(schema.taskTable)
        .innerJoin(
          schema.projectTable,
          eq(schema.taskTable.projectId, schema.projectTable.id),
        )
        .leftJoin(
          schema.columnTable,
          eq(schema.taskTable.columnId, schema.columnTable.id),
        )
        .where(
          and(
            eq(schema.projectTable.workspaceId, subject.workspaceId),
            projectAccessCondition(subject.userId, schema.projectTable.id),
            projectId ? eq(schema.taskTable.projectId, projectId) : undefined,
            sql`${schema.taskTable.status} <> 'archived' and not coalesce(${schema.columnTable.isFinal}, ${schema.taskTable.status} = 'done')`,
          ),
        )
        .groupBy(schema.taskTable.userId)
        .orderBy(schema.taskTable.userId)
        .limit(100),
    "Agent workload query timed out",
  );
}
