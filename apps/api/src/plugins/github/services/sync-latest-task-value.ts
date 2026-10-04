import { dispatchIssueWrite } from "../../sync/dispatch-issue-write";
import { canSyncTask } from "../../sync/eligibility";
import { deferTaskSync } from "./defer-issue-edit";
import { randomUUID } from "node:crypto";
import db from "../../../database";
import {
  issueEditScope,
  parseDeferredIssueEdit,
} from "../utils/deferred-issue-edit";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import { hasNewerObservedEdit, type SyncStamp } from "../utils/sync-echo";
import { applyObservedTaskValue } from "./apply-observed-task-value";
import {
  linkedTaskScope,
  integrationTaskRevision,
} from "./integration-task-scope";
import { findExternalLinksByTask, updateExternalLink } from "./link-manager";
import { isTaskInFinalState } from "./task-service";

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
  expectedBinding?: { type?: string; config?: string },
  repair = false,
) {
  let value = initialValue;
  let attempts = 0;
  let identity = expectedBinding;
  let lastIntentId: string | undefined;
  const currentBinding = async () => {
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
          binding.integration.projectId !== projectId ||
          (identity?.type !== undefined &&
            binding.integration.type !== identity.type) ||
          (identity?.config !== undefined &&
            binding.integration.config !== identity.config)))
    ) {
      // The old request cannot identify deliveries from the retained new binding.
      // Retire only its UUID, preserving newer intents and current field metadata.
      if (lastIntentId)
        await updateExternalLink(link.id, {
          retireOutboundIntents: { field, intentIds: [lastIntentId] },
        });
      return;
    }
    if (
      !(await canSyncTask(
        taskId,
        link.integrationId ?? "",
        undefined,
        identity?.config,
      ))
    )
      return;
    return binding;
  };
  for (;;) {
    const binding = await currentBinding();
    if (!binding) return;
    identity ??= binding.integration
      ? { type: binding.integration.type, config: binding.integration.config }
      : undefined;
    const queued = parseDeferredIssueEdit(
      parseLinkMetadata<{ deferredIssueEdit?: unknown }>(binding.metadata, {
        externalLinkId: link.id,
        source: "outbound_repair",
      }).deferredIssueEdit,
    );
    const repairing =
      repair ||
      !!(
        queued?.repairFields?.includes(field) &&
        binding.integration &&
        issueEditScope(binding.integration) === queued.scope
      );
    const intentId = randomUUID();
    lastIntentId = intentId;
    // Webhooks may arrive before PATCH returns, including from another instance.
    const persisted = await updateExternalLink(link.id, {
      outbound: { field, value, intentId, pending: true },
    });
    if (persisted === false || !(await currentBinding())) return;
    let updatedAt: string | undefined;
    try {
      const dispatched = await dispatchIssueWrite(
        { ...link, taskId },
        identity?.config,
        () => write(value),
      );
      if (!dispatched) {
        await updateExternalLink(link.id, {
          outbound: {
            field,
            value,
            intentId,
            pending: false,
            cancelled: true,
            uncertain: false,
          },
        });
        return;
      }
      updatedAt = dispatched.value;
      attempts++;
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
      if (!rejected && binding.integration?.config && (await currentBinding()))
        await deferTaskSync({ id: link.id, taskId }, binding.integration, [
          field,
        ]).catch(() => {});
      throw error;
    }
    if (!(await currentBinding())) return;
    await updateExternalLink(link.id, {
      ...(field === "title" ? { title: value } : {}),
      outbound: { field, value, updatedAt, intentId, pending: false },
      ...(repairing ? { retireUncertainOutbound: field } : {}),
      ...(field === "state"
        ? { metadata: { state: value, lastOutboundStateSyncAt: Date.now() } }
        : {}),
    });
    const currentLink = await currentBinding();
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
      readCurrent
    ) {
      const revision = await integrationTaskRevision(taskId, projectId);
      if (!(await currentBinding())) return;
      if (
        revision &&
        (await readCurrent()) === value &&
        (await applyObservedTaskValue(
          currentLink,
          currentLink.integration,
          field,
          value,
          intentId,
          updatedAt,
          revision,
          identity,
        )) === true
      )
        return true;
    }
    const task = await db.query.taskTable.findFirst({
      where: linkedTaskScope(taskId, projectId),
      columns: {
        title: true,
        description: true,
        status: true,
        columnId: true,
        projectId: true,
      },
    });
    if (!task) return;
    const current =
      field === "state"
        ? (await isTaskInFinalState(task))
          ? "closed"
          : "open"
        : field === "title"
          ? task.title
          : task.description || "";
    if (current === value) return true;
    if (attempts >= 3) {
      if (binding.integration)
        await deferTaskSync({ id: link.id, taskId }, binding.integration, [
          field,
        ]);
      return;
    }
    value = current;
  }
}
