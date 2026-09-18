import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, projectTable } from "../../database/schema";
import { insertProject } from "../../project/controllers/create-project";
import createTask from "./create-task";

export const DAILY_TASK_PROJECT = {
  name: "Daily Task",
  slug: "DAILY",
  icon: "CalendarCheck",
} as const;

// Tasks created without a project land in the workspace's "Daily Task"
// project, which is created on first use. The workspace project lock (same key
// as `insertProject`) keeps two concurrent first-uses from creating two.
async function getOrCreateDailyTaskProject(workspaceId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
    );

    const existing = await tx.query.projectTable.findFirst({
      where: and(
        eq(projectTable.workspaceId, workspaceId),
        eq(projectTable.name, DAILY_TASK_PROJECT.name),
        isNull(projectTable.archivedAt),
      ),
      orderBy: asc(projectTable.createdAt),
    });
    if (existing) return existing.id;

    const created = await insertProject(
      tx,
      workspaceId,
      DAILY_TASK_PROJECT.name,
      DAILY_TASK_PROJECT.icon,
      DAILY_TASK_PROJECT.slug,
    );
    if (!created) {
      throw new HTTPException(500, { message: "Failed to create project" });
    }
    return created.id;
  });
}

async function resolveProjectId(workspaceId: string, projectId?: string) {
  if (!projectId) return getOrCreateDailyTaskProject(workspaceId);

  const project = await db.query.projectTable.findFirst({
    where: and(
      eq(projectTable.id, projectId),
      eq(projectTable.workspaceId, workspaceId),
    ),
  });
  if (!project) {
    throw new HTTPException(400, { message: "Unknown project" });
  }
  if (project.archivedAt) {
    throw new HTTPException(400, { message: "Project is archived" });
  }
  return project.id;
}

async function createQuickTask({
  workspaceId,
  currentUserId,
  title,
  description,
  projectId,
  dueDate,
  priority,
}: {
  workspaceId: string;
  currentUserId: string;
  title: string;
  description?: string;
  projectId?: string;
  dueDate?: Date;
  priority?: string;
}) {
  const resolvedProjectId = await resolveProjectId(workspaceId, projectId);

  // Projects can rename or reorder their columns, so start in whichever column
  // comes first rather than assuming "to-do" exists.
  const [firstColumn] = await db
    .select({ slug: columnTable.slug })
    .from(columnTable)
    .where(eq(columnTable.projectId, resolvedProjectId))
    .orderBy(asc(columnTable.position))
    .limit(1);

  return createTask({
    projectId: resolvedProjectId,
    currentUserId,
    userId: currentUserId,
    title,
    description,
    status: firstColumn?.slug ?? "to-do",
    dueDate,
    priority,
  });
}

export default createQuickTask;
