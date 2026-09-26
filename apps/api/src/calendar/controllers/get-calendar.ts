import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceHolidayTable, workspaceTable } from "../../database/schema";

async function getCalendar(workspaceId: string) {
  const [workspace] = await db
    .select({ workingDays: workspaceTable.workingDays })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  const holidays = await db
    .select({
      id: workspaceHolidayTable.id,
      date: workspaceHolidayTable.date,
      name: workspaceHolidayTable.name,
    })
    .from(workspaceHolidayTable)
    .where(eq(workspaceHolidayTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceHolidayTable.date));

  return {
    workingDays: workspace.workingDays,
    holidays,
  };
}

export default getCalendar;
