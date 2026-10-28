import { and, not, or, sql, type SQL } from "drizzle-orm";
import { externalLinkTable, taskTable } from "../../database/schema";

export function reconciliationPredicate(integrationId: string, outgoing: SQL) {
  const linked = sql<boolean>`exists (
    select 1 from ${externalLinkTable} scoped_link
    where scoped_link.task_id = ${taskTable.id}
      and scoped_link.integration_id = ${integrationId}
      and scoped_link.resource_type = 'issue'
  )`;
  const pending = sql<boolean>`exists (
    select 1 from ${externalLinkTable} scoped_link
    where scoped_link.task_id = ${taskTable.id}
      and scoped_link.integration_id = ${integrationId}
      and scoped_link.resource_type = 'issue'
      and scoped_link.metadata ~ '"syncInitializationPending"[[:space:]]*:[[:space:]]*true'
      and not coalesce(scoped_link.metadata ~ '"syncFilterPaused"[[:space:]]*:[[:space:]]*true', false)
  )`;
  const unpaused = sql<boolean>`exists (
    select 1 from ${externalLinkTable} scoped_link
    where scoped_link.task_id = ${taskTable.id}
      and scoped_link.integration_id = ${integrationId}
      and scoped_link.resource_type = 'issue'
      and not coalesce(scoped_link.metadata ~ '"syncFilterPaused"[[:space:]]*:[[:space:]]*true', false)
  )`;
  // Label renames and reconnects also use reconciliation, so excluded links
  // still need pausing even when no rule-save transaction ran beforehand.
  return or(
    and(outgoing, or(not(linked), pending)),
    and(not(outgoing), unpaused),
  );
}
