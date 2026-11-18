import type db from "../../database";
import { sprintTable } from "../../database/schema";
import { chunk } from "./chunk";
import type { PlannedImportSprint } from "./plan-import-sprints";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Returns the sprint key to created sprint id mapping used to place tasks.
export async function writeImportSprints(
  tx: Transaction,
  projectId: string,
  planned: readonly PlannedImportSprint[],
): Promise<Map<string, string>> {
  for (const batch of chunk(planned)) {
    await tx.insert(sprintTable).values(
      batch.map((sprint) => ({
        id: sprint.id,
        projectId,
        name: sprint.name,
        status: sprint.status,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        position: sprint.position,
      })),
    );
  }

  return new Map(planned.map((sprint) => [sprint.key, sprint.id]));
}
