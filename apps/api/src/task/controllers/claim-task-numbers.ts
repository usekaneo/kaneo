import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function claimTaskNumbers(
  projectId: string,
  count: number,
  dbOrTx: DbOrTx = db,
) {
  const [updated] = await dbOrTx
    .update(projectTable)
    .set({
      lastTaskNumber: sql`${projectTable.lastTaskNumber} + ${count}`,
    })
    .where(eq(projectTable.id, projectId))
    .returning({ lastTaskNumber: projectTable.lastTaskNumber });

  if (!updated) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  return updated.lastTaskNumber - count + 1;
}

export async function claimTaskNumber(projectId: string, dbOrTx: DbOrTx = db) {
  return claimTaskNumbers(projectId, 1, dbOrTx);
}

export default claimTaskNumbers;
