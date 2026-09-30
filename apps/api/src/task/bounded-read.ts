import { sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";

export type TaskReadDatabase = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function boundedTaskRead<T>(
  read: (tx: TaskReadDatabase) => Promise<T>,
  message = "Description request took too long; retry later",
) {
  try {
    return await db.transaction(
      async (tx) => {
        await tx.execute(sql`set local statement_timeout = '3s'`);
        return read(tx);
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  } catch (error) {
    const cause = error instanceof Error ? (error.cause ?? error) : error;
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "57014"
    )
      throw new HTTPException(503, { message });
    throw error;
  }
}
