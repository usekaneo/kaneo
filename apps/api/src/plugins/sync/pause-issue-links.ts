import { and, asc, eq, gt, sql, type SQL } from "drizzle-orm";
import { externalLinkTable, taskTable } from "../../database/schema";
import type { IntegrationDatabase } from "../github/services/integration-task-scope";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";

export async function pauseIssueLinks(
  projectId: string,
  integrationId: string,
  excluded: SQL,
  tx: IntegrationDatabase,
) {
  let cursor: string | undefined;
  for (;;) {
    const links = await tx
      .select({
        id: externalLinkTable.id,
        metadata: externalLinkTable.metadata,
      })
      .from(externalLinkTable)
      .innerJoin(taskTable, eq(taskTable.id, externalLinkTable.taskId))
      .where(
        and(
          eq(externalLinkTable.integrationId, integrationId),
          eq(externalLinkTable.resourceType, "issue"),
          eq(taskTable.projectId, projectId),
          excluded,
          cursor ? gt(externalLinkTable.id, cursor) : undefined,
          sql`not coalesce(${externalLinkTable.metadata} ~ '"syncFilterPaused"[[:space:]]*:[[:space:]]*true', false)`,
        ),
      )
      .orderBy(asc(externalLinkTable.id))
      .limit(100)
      .for("update", { of: externalLinkTable });
    if (!links.length) return;
    const values = sql.join(
      links.map(
        (link) =>
          sql`(${link.id}::text, ${JSON.stringify({
            ...parseLinkMetadata(link.metadata, {
              externalLinkId: link.id,
              source: "sync_pause",
            }),
            syncFilterPaused: true,
          })}::text)`,
      ),
      sql`, `,
    );
    // Locked rows retain concurrent sync metadata. One update per bounded page
    // replaces a metadata transaction and round trip for every issue link.
    await tx.execute(
      sql`update ${externalLinkTable} set metadata = paused.metadata, updated_at = ${new Date()} from (values ${values}) as paused(id, metadata) where ${externalLinkTable.id} = paused.id`,
    );
    cursor = links.at(-1)!.id;
  }
}
