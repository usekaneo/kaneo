import { and, count, eq, max, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../../database";
import { taskTable } from "../../database/schema";

export const MAX_TASK_POSITION = 2_147_483_646;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function assertTaskPosition(position: number) {
  if (
    !Number.isInteger(position) ||
    position < 0 ||
    position > MAX_TASK_POSITION
  ) {
    throw new HTTPException(400, {
      message: `Position must be an integer between 0 and ${MAX_TASK_POSITION}`,
    });
  }
}

// Call after claimTaskNumber has locked the destination project in this same
// transaction, so concurrent creates/moves cannot allocate the same position.
export async function nextTaskPosition(
  tx: Transaction,
  projectId: string,
  status: string,
  columnId: string | null,
) {
  const scope = and(
    eq(taskTable.projectId, projectId),
    columnId ? eq(taskTable.columnId, columnId) : eq(taskTable.status, status),
  );
  const [range] = await tx
    .select({ maximum: max(taskTable.position), total: count() })
    .from(taskTable)
    .where(scope);
  const maximum = Math.max(0, range?.maximum ?? 0);
  if (maximum < MAX_TASK_POSITION) return maximum + 1;

  // Repair legacy poisoned positions in SQL, preserving relative order. Merely
  // rejecting future bad values would leave existing projects unable to append.
  const total = range?.total ?? 0;
  if (total >= MAX_TASK_POSITION) {
    throw new HTTPException(409, {
      message: "Task column has reached its capacity",
    });
  }
  await tx.execute(sql`
    WITH ranked AS (
      SELECT ${taskTable.id} AS id,
        row_number() OVER (ORDER BY ${taskTable.position}, ${taskTable.createdAt}, ${taskTable.id}) AS position
      FROM ${taskTable}
      WHERE ${scope}
    )
    UPDATE ${taskTable} SET position = ranked.position::integer
    FROM ranked WHERE ${taskTable.id} = ranked.id
  `);
  return total + 1;
}
