import { and, eq } from "drizzle-orm";
import { PendingEcho } from "../utils/inbound-echo";
import { updateExternalLink } from "./link-manager";
import { externalLinkTable } from "../../../database/schema";
import { canSyncTask } from "../../sync/eligibility";
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
  expectedBinding?: Parameters<typeof withIntegrationTask>[3],
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
      if (
        lockedLink.resourceType === "issue" &&
        !(await canSyncTask(
          link.taskId,
          integration.id,
          database,
          expectedBinding?.config,
        ))
      )
        return;
      try {
        const result = await apply(database, afterCommit, lockedLink);
        // Inbound label mutations can remove the predicate that admitted this
        // callback. Commit its paused link with the mutation, before events run.
        if (lockedLink.resourceType === "issue")
          await canSyncTask(
            link.taskId,
            integration.id,
            database,
            expectedBinding?.config,
          );
        return result;
      } catch (error) {
        if (!(error instanceof PendingEcho)) throw error;
        if (error.context && error.intentId && error.updatedAt) {
          await updateExternalLink(
            lockedLink.id,
            {
              observedOutbound: {
                field: error.context.field,
                intentId: error.intentId,
                updatedAt: error.updatedAt,
              },
            },
            database,
          );
          error.recorded = true;
        }
        return error;
      }
    },
    expectedBinding,
  );
}
