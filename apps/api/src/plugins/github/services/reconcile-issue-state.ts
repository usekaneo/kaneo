import { isStateSyncPaused } from "../../sync/state-sync-paused";
import { linkedTaskScope } from "./integration-task-scope";
import { updateExternalLink } from "./link-manager";
import { isTaskInFinalState } from "./task-service";
import { withIntegrationLink } from "./with-integration-link";

// A matching provider read is not another outbound write. Update only the
// displayed state, under the same task and binding locks used by inbound sync.
export function reconcileIssueState(
  link: { id: string; taskId: string },
  integration: Parameters<typeof withIntegrationLink>[1],
  value: string,
  expectedBinding: Parameters<typeof withIntegrationLink>[3],
) {
  return withIntegrationLink(
    link,
    integration,
    async (tx) => {
      const task = await tx.query.taskTable.findFirst({
        where: linkedTaskScope(link.taskId, integration.projectId),
      });
      if (!task || isStateSyncPaused(task.status)) return false;
      const current = (await isTaskInFinalState(task, tx)) ? "closed" : "open";
      if (current !== value) return false;
      await updateExternalLink(link.id, { metadata: { state: value } }, tx);
      return true;
    },
    expectedBinding,
  );
}
