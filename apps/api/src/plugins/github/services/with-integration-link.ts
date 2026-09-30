import { and, eq } from "drizzle-orm";
import { externalLinkTable } from "../../../database/schema";
import {
  withIntegrationTask,
  type IntegrationDatabase,
} from "./integration-task-scope";

export function withIntegrationLink<T>(
  link: { id: string; taskId: string },
  integration: Parameters<typeof withIntegrationTask>[1],
  apply: (
    database: IntegrationDatabase,
    afterCommit: (effect: () => Promise<void>) => void,
    lockedLink: typeof externalLinkTable.$inferSelect,
  ) => Promise<T>,
) {
  return withIntegrationTask(
    link.taskId,
    integration,
    async (database, afterCommit) => {
      const [lockedLink] = await database
        .select()
        .from(externalLinkTable)
        .where(
          and(
            eq(externalLinkTable.id, link.id),
            eq(externalLinkTable.taskId, link.taskId),
            eq(externalLinkTable.integrationId, integration.id),
          ),
        )
        .for("update");
      if (!lockedLink) return;
      return apply(database, afterCommit, lockedLink);
    },
  );
}
