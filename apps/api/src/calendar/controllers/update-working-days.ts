import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceTable } from "../../database/schema";

async function updateWorkingDays(workspaceId: string, workingDays: number) {
  const [updated] = await db
    .update(workspaceTable)
    .set({ workingDays })
    .where(eq(workspaceTable.id, workspaceId))
    .returning({ workingDays: workspaceTable.workingDays });

  if (!updated) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  return updated;
}

export default updateWorkingDays;
