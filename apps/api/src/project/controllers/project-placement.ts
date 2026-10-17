import { and, eq, max, ne, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../../database";
import { projectTable } from "../../database/schema";
import { findProjectKeyConflict, projectKeyTakenMessage } from "../project-key";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockProjectOrdering(
  tx: Transaction,
  workspaceId: string,
) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
  );
}

export async function assertProjectKeyAvailable(
  tx: Transaction,
  workspaceId: string,
  slug: string,
  excludeProjectId?: string,
) {
  const keyConflict = await findProjectKeyConflict(tx, workspaceId, slug, {
    excludeProjectId,
  });
  if (keyConflict) {
    throw new HTTPException(409, {
      message: projectKeyTakenMessage(slug, keyConflict.name),
    });
  }
}

export async function nextProjectPosition(
  tx: Transaction,
  workspaceId: string,
  excludeProjectId?: string,
) {
  const [{ maxPosition } = { maxPosition: null }] = await tx
    .select({ maxPosition: max(projectTable.position) })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        excludeProjectId ? ne(projectTable.id, excludeProjectId) : undefined,
      ),
    );
  return maxPosition === null ? 0 : maxPosition + 1;
}
