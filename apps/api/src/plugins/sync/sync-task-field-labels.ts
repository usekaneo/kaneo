import { and, eq } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable } from "../../database/schema";
import { linkedTaskScope } from "../github/services/integration-task-scope";
import { updateExternalLink } from "../github/services/link-manager";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";
import type { PluginContext } from "../types";
import { createIssueWrite } from "./dispatch-issue-write";
import { canSyncTask } from "./eligibility";
import type { IssueWrite } from "./issue-write";
import { withSyncLease } from "./lease";
import { providerIssue } from "./provider-issue";

export async function syncTaskFieldLabels(
  taskId: string,
  context: PluginContext,
  link: { id: string; externalId: string },
  provider: string,
  field: "priority" | "status",
  send: (
    changes: { add: string[]; remove: string[] },
    write: IssueWrite,
  ) => Promise<void>,
) {
  const config = JSON.stringify(context.config);
  return withSyncLease(`sync-field-labels:${link.id}`, async () => {
    const remote = await providerIssue(
      { type: provider, config },
      { ...link, taskId },
    );
    const write = createIssueWrite(
      { ...link, taskId, integrationId: context.integrationId },
      config,
    );
    for (;;) {
      if (
        !(await canSyncTask(taskId, context.integrationId, undefined, config))
      )
        return;
      const task = await db.query.taskTable.findFirst({
        where: linkedTaskScope(taskId, context.projectId),
      });
      if (!task) return;
      const value = task[field] ?? "no-priority";
      const labels = (await remote.read()).labels;
      const prefix = `${field}:`;
      const add =
        field === "priority" && value === "no-priority"
          ? []
          : [`${prefix}${value}`];
      const remove = labels.filter(
        (name) => name.startsWith(prefix) && !add.includes(name),
      );
      await send({ add, remove }, write);
      if (
        !(await canSyncTask(taskId, context.integrationId, undefined, config))
      )
        return;
      const stored = await db.query.externalLinkTable.findFirst({
        where: and(
          eq(externalLinkTable.id, link.id),
          eq(externalLinkTable.integrationId, context.integrationId),
        ),
      });
      if (!stored) return;
      const metadata = parseLinkMetadata<{
        syncResumeLabelBaseline?: string[];
      }>(stored.metadata, {
        externalLinkId: link.id,
        source: "outbound_field_labels",
      });
      if (Array.isArray(metadata.syncResumeLabelBaseline))
        await updateExternalLink(link.id, {
          metadata: {
            syncResumeLabelBaseline: [
              ...metadata.syncResumeLabelBaseline.filter(
                (name) => typeof name === "string" && !name.startsWith(prefix),
              ),
              ...add,
            ],
          },
        });
      const current = await db.query.taskTable.findFirst({
        where: linkedTaskScope(taskId, context.projectId),
        columns: { priority: true, status: true },
      });
      if (!current) return;
      // A later event may time out waiting for this lease. The current owner
      // repairs edits made during its provider request before releasing it.
      if ((current[field] ?? "no-priority") === value) return value;
    }
  }).catch(() => {
    console.error("Issue field label synchronization failed", {
      integrationId: context.integrationId,
      linkId: link.id,
      field,
    });
    throw new Error("Issue field label synchronization failed");
  });
}
