import type { ImportedLabel } from "@kaneo/importers";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type db from "../../database";
import { labelTable } from "../../database/schema";
import { chunk } from "./chunk";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type TaskLabelKeys = { id: string; labelKeys: readonly string[] };

const DEFAULT_LABEL_COLOR = "gray";
const MAX_COLOR_LENGTH = 64;

function importColor(color: string | undefined) {
  const trimmed = color?.trim();
  return trimmed && trimmed.length <= MAX_COLOR_LENGTH
    ? trimmed
    : DEFAULT_LABEL_COLOR;
}

export async function writeImportLabels(
  tx: Transaction,
  workspaceId: string,
  labels: readonly ImportedLabel[],
  tasks: readonly TaskLabelKeys[],
): Promise<number> {
  const byKey = new Map(labels.map((label) => [label.key, label]));
  const colors = new Map<string, string>();
  const taskLabels: { taskId: string; name: string }[] = [];

  for (const task of tasks) {
    const names = new Set<string>();
    for (const key of task.labelKeys) {
      const label = byKey.get(key);
      const name = label?.name.trim();
      if (!label || !name) continue;
      names.add(name);
      if (!colors.has(name)) colors.set(name, importColor(label.color));
    }
    for (const name of names) taskLabels.push({ taskId: task.id, name });
  }

  const names = [...colors.keys()];
  if (names.length === 0) return 0;

  for (const batch of chunk(names)) {
    await tx
      .insert(labelTable)
      .values(
        batch.map((name) => ({
          name,
          color: colors.get(name) ?? DEFAULT_LABEL_COLOR,
          taskId: null,
          workspaceId,
        })),
      )
      .onConflictDoNothing({
        target: [labelTable.workspaceId, labelTable.name],
        where: sql`${labelTable.taskId} is null`,
      });
  }

  const definitionColors = new Map<string, string>();
  for (const batch of chunk(names)) {
    const definitions = await tx
      .select({ name: labelTable.name, color: labelTable.color })
      .from(labelTable)
      .where(
        and(
          eq(labelTable.workspaceId, workspaceId),
          isNull(labelTable.taskId),
          inArray(labelTable.name, batch),
        ),
      );
    for (const definition of definitions) {
      definitionColors.set(definition.name, definition.color);
    }
  }

  for (const batch of chunk(taskLabels)) {
    await tx
      .insert(labelTable)
      .values(
        batch.map(({ taskId, name }) => ({
          name,
          color:
            definitionColors.get(name) ??
            colors.get(name) ??
            DEFAULT_LABEL_COLOR,
          taskId,
          workspaceId,
        })),
      )
      .onConflictDoNothing({ target: [labelTable.taskId, labelTable.name] });
  }

  return names.length;
}
