import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { columnTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { VIRTUAL_STATUSES } from "../../task/validate-task-fields";
import {
  ColumnCreateFailed,
  DuplicateColumnSlug,
  InvalidColumnName,
  ReservedColumnSlug,
} from "../errors";

export function toSlug(name: string): string {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return /[\p{L}\p{N}]/u.test(slug) ? slug : "";
}

const createColumn = Effect.fn("column.createColumn")(function* ({
  projectId,
  name,
  icon,
  color,
  isFinal,
}: {
  projectId: string;
  name: string;
  icon?: string;
  color?: string;
  isFinal?: boolean;
}) {
  const database = yield* Database;

  const slug = toSlug(name);

  if (!slug) {
    return yield* new InvalidColumnName({ name });
  }

  if ((VIRTUAL_STATUSES as readonly string[]).includes(slug)) {
    return yield* new ReservedColumnSlug({ slug });
  }

  const existing = yield* database.query((db) =>
    db
      .select({ id: columnTable.id })
      .from(columnTable)
      .where(
        sql`${columnTable.projectId} = ${projectId} AND ${columnTable.slug} = ${slug}`,
      ),
  );

  if (existing.length > 0) {
    return yield* new DuplicateColumnSlug({ projectId, slug });
  }

  const [maxPos] = yield* database.query((db) =>
    db
      .select({
        maxPosition: sql<number>`COALESCE(MAX(${columnTable.position}), -1)`,
      })
      .from(columnTable)
      .where(eq(columnTable.projectId, projectId)),
  );

  const position = (maxPos?.maxPosition ?? -1) + 1;

  const [created] = yield* database.query((db) =>
    db
      .insert(columnTable)
      .values({
        projectId,
        name,
        slug,
        position,
        icon: icon || null,
        color: color || null,
        isFinal: isFinal ?? false,
      })
      .returning(),
  );

  if (!created) {
    return yield* new ColumnCreateFailed({ projectId });
  }

  return created;
});

export default createColumn;
