import { randomUUID } from "node:crypto";
import db from "../../../database";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import { hasNewerObservedEdit, type SyncStamp } from "../utils/sync-echo";
import { applyObservedTaskValue } from "./apply-observed-task-value";
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
  readCurrent?: () => Promise<string>,
) {
  let value = initialValue;
  for (;;) {
    const binding = (await findExternalLinksByTask(taskId)).find(
      (candidate) =>
        candidate.id === link.id &&
        candidate.integrationId === link.integrationId &&
        candidate.resourceType === "issue",
    );
    if (
      !binding ||
      (binding.integration &&
        (binding.integration.isActive === false ||
          binding.integration.projectId !== projectId))
    )
      return;
    const intentId = randomUUID();
    // Webhooks may arrive before PATCH returns, including from another instance.
    const persisted = await updateExternalLink(link.id, {
      outbound: { field, value, intentId, pending: true },
    });
    if (persisted === false) return;
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
    );
    // The waiting inbound handler applies this newer provider edit after the
    // exact response version is available; do not overwrite it with a repair.
    if (
      hasNewerObservedEdit(observed, updatedAt) &&
      currentLink.integration &&
      readCurrent &&
      (await readCurrent()) === value
    ) {
      await applyObservedTaskValue(
        currentLink,
        currentLink.integration,
        field,
        value,
        intentId,
        updatedAt,
      );
      return;
    }
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
    value = current;
  }
}
