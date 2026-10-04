import db from "../../database";
import { and, eq } from "drizzle-orm";
import { externalLinkTable } from "../../database/schema";
import { linkedTaskScope } from "../github/services/integration-task-scope";
import { updateExternalLink } from "../github/services/link-manager";
import { syncLatestTaskValue } from "../github/services/sync-latest-task-value";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";
import type { PluginContext, TaskCreatedEvent } from "../types";
import { canSyncTask } from "./eligibility";

export async function initializeTaskText(
  event: TaskCreatedEvent,
  context: PluginContext,
  link: { id: string; metadata?: string | null },
  send: (
    field: "title" | "description",
    value: string,
  ) => Promise<string | undefined>,
) {
  const task = await db.query.taskTable.findFirst({
    where: linkedTaskScope(event.taskId, context.projectId),
  });
  if (!task) throw new Error("Task sync scope changed");
  const stored = await db.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.id, link.id),
      eq(externalLinkTable.taskId, event.taskId),
      eq(externalLinkTable.integrationId, context.integrationId),
    ),
    columns: { metadata: true },
  });
  if (!stored) throw new Error("Issue sync scope changed");
  const progress = parseLinkMetadata<{
    syncInitializedText?: { title: string; description: string };
    syncCreatedText?: { title: string; description: string };
  }>(stored.metadata, {
    externalLinkId: link.id,
    source: "sync_initialization",
  });
  const previous = progress.syncInitializedText ?? progress.syncCreatedText;
  const values = { title: task.title, description: task.description ?? "" };
  for (const field of ["title", "description"] as const) {
    if (previous?.[field] === values[field]) continue;
    await syncLatestTaskValue(
      task.id,
      context.projectId,
      { id: link.id, integrationId: context.integrationId },
      field,
      values[field],
      (value) => send(field, value),
      undefined,
      { config: JSON.stringify(context.config) },
    );
  }
  if (
    !(await canSyncTask(
      event.taskId,
      context.integrationId,
      undefined,
      JSON.stringify(context.config),
    ))
  )
    throw new Error("Issue sync scope changed");
  await updateExternalLink(link.id, {
    metadata: { syncInitializedText: values },
  });
  const current = await db.query.taskTable.findFirst({
    where: linkedTaskScope(event.taskId, context.projectId),
  });
  if (!current || current.number === null)
    throw new Error("Task sync scope changed");
  return {
    ...event,
    title: current.title,
    description: current.description,
    priority: current.priority,
    status: current.status,
    userId: current.userId ?? "",
    number: current.number,
  };
}
