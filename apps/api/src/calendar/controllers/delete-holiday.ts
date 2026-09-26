import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceHolidayTable } from "../../database/schema";

async function deleteHoliday(workspaceId: string, holidayId: string) {
  const [deleted] = await db
    .delete(workspaceHolidayTable)
    .where(
      and(
        eq(workspaceHolidayTable.id, holidayId),
        eq(workspaceHolidayTable.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Holiday not found" });
  }

  return deleted;
}

export default deleteHoliday;
