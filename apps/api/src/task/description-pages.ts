import { and, asc, eq, gt, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable, taskTable } from "../database/schema";
import { boundedTaskRead } from "./bounded-read";

export const BOARD_DESCRIPTION_MAX_BYTES = 64 * 1024;
export const DESCRIPTION_CHUNK_CHARACTERS = 32 * 1024;
export const DESCRIPTION_MATCH_PAGE_SIZE = 100;
export const projectDescriptionDeferred = sql<boolean>`coalesce(octet_length(${projectTable.description}) > ${BOARD_DESCRIPTION_MAX_BYTES}, false)`;
export const boardProjectDescription = sql<
  string | null
>`case when ${projectDescriptionDeferred} then null else ${projectTable.description} end`;
export const descriptionDeferred = sql<boolean>`coalesce(octet_length(${taskTable.description}) > ${BOARD_DESCRIPTION_MAX_BYTES}, false)`;
export const boardDescription = sql<
  string | null
>`case when ${descriptionDeferred} then null else ${taskTable.description} end`;

export async function getDescriptionPage(
  taskId: string,
  options: { offset: number; version?: string; publicProjectId?: string },
) {
  return boundedTaskRead(async (tx) => {
    const conditions = [eq(taskTable.id, taskId)];
    if (options.publicProjectId)
      conditions.push(
        eq(taskTable.projectId, options.publicProjectId),
        eq(projectTable.isPublic, true),
      );
    if (options.version)
      conditions.push(sql`${taskTable}.xmin::text = ${options.version}`);
    const [row] = await tx
      .select({
        content: sql<string>`coalesce(substring(${taskTable.description} from ${options.offset + 1}::integer for ${DESCRIPTION_CHUNK_CHARACTERS + 1}::integer), '')`,
        version: sql<string>`${taskTable}.xmin::text`,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(and(...conditions))
      .limit(1);
    if (!row)
      throw new HTTPException(options.version ? 409 : 404, {
        message:
          "Description changed or is unavailable; refresh before loading it again",
      });
    // PostgreSQL offsets count Unicode characters, not JavaScript UTF-16 units.
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

export async function getDeferredDescriptionMatches(
  projectId: string,
  query: string,
  after?: string,
) {
  return boundedTaskRead(async (tx) => {
    const rows = await tx
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.projectId, projectId),
          descriptionDeferred,
          sql`strpos(lower(${taskTable.description}), lower(${query})) > 0`,
          after ? gt(taskTable.id, after) : undefined,
        ),
      )
      .orderBy(asc(taskTable.id))
      .limit(DESCRIPTION_MATCH_PAGE_SIZE + 1);
    const matches = rows.slice(0, DESCRIPTION_MATCH_PAGE_SIZE);
    return {
      ids: matches.map((row) => row.id),
      nextCursor:
        rows.length > DESCRIPTION_MATCH_PAGE_SIZE
          ? (matches.at(-1)?.id ?? null)
          : null,
    };
  });
}

export async function getPublicProjectDescriptionPage(
  projectId: string,
  options: { offset: number; version?: string },
) {
  return boundedTaskRead(async (tx) => {
    const [row] = await tx
      .select({
        content: sql<string>`coalesce(substring(${projectTable.description} from ${options.offset + 1}::integer for ${DESCRIPTION_CHUNK_CHARACTERS + 1}::integer), '')`,
        version: sql<string>`${projectTable}.xmin::text`,
      })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, projectId),
          eq(projectTable.isPublic, true),
          options.version
            ? sql`${projectTable}.xmin::text = ${options.version}`
            : undefined,
        ),
      )
      .limit(1);
    if (!row)
      throw new HTTPException(options.version ? 409 : 404, {
        message:
          "Description changed or is unavailable; refresh before loading it again",
      });
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
