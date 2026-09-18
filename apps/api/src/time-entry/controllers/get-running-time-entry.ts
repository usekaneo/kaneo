import { and, desc, eq, isNull } from "drizzle-orm";
import { projectTable, timeEntryTable } from "../../database/schema";
import { selectTimeEntryDetails } from "./select-time-entry-details";

async function getRunningTimeEntry(userId: string, workspaceId: string) {
  const [running] = await selectTimeEntryDetails()
    .where(
      and(
        eq(timeEntryTable.userId, userId),
        isNull(timeEntryTable.endTime),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(timeEntryTable.startTime))
    .limit(1);

  return running ?? null;
}

export default getRunningTimeEntry;
