import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { labelTable } from "../../database/schema";
import type { IntegrationDatabase } from "../github/services/integration-task-scope";
import { getLabelsForIssue } from "../github/utils/format";
import { issueLabelNames } from "./rules";

export async function taskIssueLabels(
  taskId: string,
  priority: string | null,
  status: string,
) {
  const assigned = await db
    .select({ name: labelTable.name })
    .from(labelTable)
    .where(eq(labelTable.taskId, taskId));
  return [
    ...new Set([
      ...getLabelsForIssue(priority, status),
      ...assigned
        .map((label) => label.name)
        .filter(
          (name) =>
            !name.startsWith("status:") && !name.startsWith("priority:"),
        ),
    ]),
  ];
}

export async function importIssueLabels(
  taskId: string,
  workspaceId: string,
  labels: unknown,
  database: IntegrationDatabase = db,
) {
  const names = issueLabelNames(labels).filter(
    (name) => !name.startsWith("status:") && !name.startsWith("priority:"),
  );
  if (!names.length) return;
  const providerColors = new Map<string, string>();
  if (Array.isArray(labels))
    for (const label of labels) {
      if (
        !label ||
        typeof label !== "object" ||
        typeof label.color !== "string" ||
        !label.color
      )
        continue;
      const [name] = issueLabelNames([label]);
      if (name) providerColors.set(name, `#${label.color.replace(/^#/, "")}`);
    }
  const existing = await database
    .select({ name: labelTable.name, color: labelTable.color })
    .from(labelTable)
    .where(
      and(eq(labelTable.workspaceId, workspaceId), isNull(labelTable.taskId)),
    );
  await database
    .insert(labelTable)
    .values(
      [...new Set(names)].map((name) => ({
        name,
        color:
          existing.find((label) => label.name === name)?.color ??
          providerColors.get(name) ??
          "#6B7280",
        taskId,
        workspaceId,
      })),
    )
    .onConflictDoNothing({ target: [labelTable.taskId, labelTable.name] });
}
