import { randomUUID } from "node:crypto";
import db from "../../../database";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import type { SyncStamp } from "../utils/sync-echo";
import { linkedTaskScope } from "./integration-task-scope";
import { findExternalLinksByTask, updateExternalLink } from "./link-manager";

// Provider requests may complete out of order across API instances. Every late
// completion repairs the provider using the current, still-linked task value.
export async function syncLatestTaskValue(
  taskId: string,
  projectId: string,
  link: { id: string; integrationId: string | null },
  field: "title" | "description" | "state",
  initialValue: string,
  write: (value: string) => Promise<string | undefined>,
) {
  let value = initialValue;
  for (;;) {
    const intentId = randomUUID();
    // Webhooks may arrive before PATCH returns, including from another instance.
    await updateExternalLink(link.id, {
      outbound: { field, value, intentId, pending: true },
    });
    let updatedAt: string | undefined;
    try {
      updatedAt = await write(value);
    } catch (error) {
      const status =
        typeof error === "object" && error && "status" in error
          ? Number(error.status)
          : undefined;
      const rejected =
        status !== undefined && status >= 400 && status < 500 && status !== 408;
      await updateExternalLink(link.id, {
        outbound: {
          field,
          value,
          intentId,
          pending: false,
          cancelled: rejected,
          uncertain: !rejected,
        },
      }).catch(() => {});
      throw error;
    }
    await updateExternalLink(link.id, {
      ...(field === "title" ? { title: value } : {}),
      outbound: { field, value, updatedAt, intentId, pending: false },
      ...(field === "state"
        ? { metadata: { state: value, lastOutboundStateSyncAt: Date.now() } }
        : {}),
    });
    const currentLinks = await findExternalLinksByTask(taskId);
    const currentLink = currentLinks.find(
      (candidate) =>
        candidate.id === link.id &&
        candidate.integrationId === link.integrationId &&
        candidate.resourceType === "issue",
    );
    if (!currentLink) return;
    const metadata = parseLinkMetadata<{
      lastSync?: Record<string, SyncStamp>;
    }>(currentLink.metadata, {
      externalLinkId: link.id,
      source: "outbound_completion",
    });
    const observed = metadata.lastSync?.[field]?.outbound?.find(
      (entry) => entry.intentId === intentId,
    )?.observedUpdatedAt;
    // The waiting inbound handler applies this newer provider edit after the
    // exact response version is available; do not overwrite it with a repair.
    if (updatedAt && observed && Date.parse(observed) > Date.parse(updatedAt))
      return;
    const task = await db.query.taskTable.findFirst({
      where: linkedTaskScope(taskId, projectId),
      columns: { title: true, description: true, status: true },
    });
    if (!task) return;
    const current =
      field === "state"
        ? task.status === "done"
          ? "closed"
          : "open"
        : field === "title"
          ? task.title
          : task.description || "";
    if (current === value) return;
    const stillLinked = currentLinks.some(
      (currentLink) =>
        currentLink.id === link.id &&
        currentLink.integrationId === link.integrationId &&
        currentLink.resourceType === "issue",
    );
    if (!stillLinked) return;
    value = current;
  }
}
