import { and, eq, gte, lt } from "drizzle-orm";
import { projectTable, timeEntryTable } from "../../database/schema";
import { selectTimeEntryDetails } from "./select-time-entry-details";

type ListTimeEntriesParams = {
  workspaceId: string;
  from: Date;
  to: Date;
  userId?: string;
  projectId?: string;
};

async function listTimeEntries({
  workspaceId,
  from,
  to,
  userId,
  projectId,
}: ListTimeEntriesParams) {
  return selectTimeEntryDetails()
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        gte(timeEntryTable.startTime, from),
        lt(timeEntryTable.startTime, to),
        userId ? eq(timeEntryTable.userId, userId) : undefined,
        projectId ? eq(projectTable.id, projectId) : undefined,
      ),
    )
    .orderBy(timeEntryTable.startTime);
}

export default listTimeEntries;
