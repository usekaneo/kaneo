import { randomBytes } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  assetTable,
  columnTable,
  projectTable,
  taskShareTable,
  taskTable,
  userTable,
} from "../database/schema";
import { boundedTaskRead } from "../task/bounded-read";
import {
  BOARD_DESCRIPTION_MAX_BYTES,
  DESCRIPTION_CHUNK_CHARACTERS,
} from "../task/description-pages";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const PUBLIC_DESCRIPTION_TAGS = [
  "kaneo-attachment",
  "kaneo-embed",
  "kaneo-issue-link",
];

function sharedTaskNotFound(): never {
  throw new HTTPException(404, { message: "Shared task not found" });
}

function requireToken(token: string) {
  if (!TOKEN_PATTERN.test(token)) sharedTaskNotFound();
}

function publicDescription(token: string): SQL<string> {
  let result: SQL<string> = sql`coalesce(${taskTable.description}, '')`;
  for (const tag of PUBLIC_DESCRIPTION_TAGS) {
    result = sql<string>`regexp_replace(${result}, ${`<${tag}[^>]*>`}, '', 'gi')`;
  }
  result = sql<string>`regexp_replace(${result}, '<kaneo-mention[^>]*>[^<]*</kaneo-mention>', '', 'gi')`;
  const replacement = `\\1/api/shared-task/${token}/asset/\\2`;
  return sql<string>`regexp_replace(${result}, '(^|[\\s"''(])/api/asset/([A-Za-z0-9_-]+)', ${replacement}, 'g')`;
}

function sharedDescriptionAssetPath(
  token: string,
  assetId: string,
): SQL<string> {
  return sql<string>`'/api/shared-task/' || ${token} || '/asset/' || ${assetId}`;
}

export async function getTaskShare(taskId: string) {
  const [share] = await db
    .select()
    .from(taskShareTable)
    .where(eq(taskShareTable.taskId, taskId))
    .limit(1);
  return { share: share ?? null };
}

export async function ensureTaskShare(taskId: string) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(taskShareTable)
      .values({ taskId, token: randomBytes(32).toString("hex") })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const [existing] = await tx
      .select()
      .from(taskShareTable)
      .where(eq(taskShareTable.taskId, taskId))
      .limit(1);
    if (!existing) {
      throw new HTTPException(409, {
        message: "Could not create the task share link",
      });
    }
    return existing;
  });
}

export async function revokeTaskShare(taskId: string) {
  await db.delete(taskShareTable).where(eq(taskShareTable.taskId, taskId));
  return { success: true };
}

export async function getSharedTask(token: string) {
  requireToken(token);
  return boundedTaskRead(async (tx) => {
    const description = publicDescription(token);
    const descriptionDeferred = sql<boolean>`coalesce(octet_length(${description}) > ${BOARD_DESCRIPTION_MAX_BYTES}, false)`;
    const [task] = await tx
      .select({
        projectSlug: projectTable.slug,
        number: taskTable.number,
        title: taskTable.title,
        statusSlug: taskTable.status,
        statusName: columnTable.name,
        statusIcon: columnTable.icon,
        statusIsFinal: columnTable.isFinal,
        description: sql<
          string | null
        >`case when ${taskTable.description} is null or ${descriptionDeferred} then null else ${description} end`,
        descriptionDeferred,
        priority: taskTable.priority,
        assigneeName: userTable.name,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        createdAt: taskTable.createdAt,
        updatedAt: taskTable.updatedAt,
      })
      .from(taskShareTable)
      .innerJoin(taskTable, eq(taskTable.id, taskShareTable.taskId))
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .leftJoin(userTable, eq(userTable.id, taskTable.userId))
      .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
      .where(eq(taskShareTable.token, token))
      .limit(1);
    if (!task) sharedTaskNotFound();

    return {
      ticketKey: `${task.projectSlug.toUpperCase()}-${task.number ?? ""}`,
      title: task.title,
      status: {
        slug: task.statusSlug,
        name: task.statusName,
        icon: task.statusIcon,
        isFinal: task.statusIsFinal ?? false,
      },
      description: task.description,
      descriptionDeferred: task.descriptionDeferred,
      priority: task.priority,
      assigneeName: task.assigneeName,
      startDate: task.startDate,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  });
}

export async function getSharedTaskDescriptionPage(
  token: string,
  options: { offset: number; version?: string },
) {
  requireToken(token);
  return boundedTaskRead(async (tx) => {
    const description = publicDescription(token);
    const [row] = await tx
      .select({
        content: sql<string>`coalesce(substring(${description} from ${options.offset + 1}::integer for ${DESCRIPTION_CHUNK_CHARACTERS + 1}::integer), '')`,
        version: sql<string>`${taskTable}.xmin::text`,
      })
      .from(taskShareTable)
      .innerJoin(taskTable, eq(taskTable.id, taskShareTable.taskId))
      .where(
        and(
          eq(taskShareTable.token, token),
          options.version
            ? sql`${taskTable}.xmin::text = ${options.version}`
            : undefined,
        ),
      )
      .limit(1);
    if (!row) {
      const [active] = await tx
        .select({ taskId: taskShareTable.taskId })
        .from(taskShareTable)
        .where(eq(taskShareTable.token, token))
        .limit(1);
      if (!active) sharedTaskNotFound();
      throw new HTTPException(409, {
        message: "Description changed; refresh before loading it again",
      });
    }

    const characters = Array.from(row.content);
    return {
      content: characters.slice(0, DESCRIPTION_CHUNK_CHARACTERS).join(""),
      version: row.version,
      nextOffset:
        characters.length > DESCRIPTION_CHUNK_CHARACTERS
          ? options.offset + DESCRIPTION_CHUNK_CHARACTERS
          : null,
    };
  });
}

export async function getSharedTaskImage(token: string, assetId: string) {
  requireToken(token);
  const description = publicDescription(token);
  const assetPath = sharedDescriptionAssetPath(token, assetId);
  const [asset] = await db
    .select({
      id: assetTable.id,
      objectKey: assetTable.objectKey,
      mimeType: assetTable.mimeType,
      filename: assetTable.filename,
    })
    .from(taskShareTable)
    .innerJoin(taskTable, eq(taskTable.id, taskShareTable.taskId))
    .innerJoin(assetTable, eq(assetTable.taskId, taskShareTable.taskId))
    .where(
      and(
        eq(taskShareTable.token, token),
        eq(assetTable.id, assetId),
        eq(assetTable.surface, "description"),
        eq(assetTable.kind, "image"),
        sql`position(${assetPath} in ${description}) > 0`,
      ),
    )
    .limit(1);
  if (!asset) sharedTaskNotFound();
  return asset;
}
