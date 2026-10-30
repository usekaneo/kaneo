import type { ImportedProject, ImportSourceId } from "@kaneo/importers";
import { createId } from "@paralleldrive/cuid2";
import { eq, sql } from "drizzle-orm";
import type db from "../../database";
import { projectTable } from "../../database/schema";
import type { ImportCounts } from "../import-run-project";
import { assignImportTaskNumbers } from "./assign-import-task-numbers";
import { loadAssignableMembers } from "./load-assignable-members";
import { createAssigneeMatcher } from "./match-assignees";
import { planImportColumns } from "./plan-import-columns";
import { planImportRelations } from "./plan-import-relations";
import { planImportTasks } from "./plan-import-tasks";
import { writeImportColumns } from "./write-import-columns";
import { writeImportComments } from "./write-import-comments";
import { writeImportLabels } from "./write-import-labels";
import { writeImportRelations } from "./write-import-relations";
import { writeImportTasks } from "./write-import-tasks";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ProjectContentInput = {
  projectId: string;
  workspaceId: string;
  userId: string;
  source: ImportSourceId;
  project: ImportedProject;
  includeComments: boolean;
};

export async function writeProjectContent(
  tx: Transaction,
  {
    projectId,
    workspaceId,
    userId,
    source,
    project,
    includeComments,
  }: ProjectContentInput,
): Promise<{ counts: ImportCounts; warnings: string[] }> {
  const now = new Date();
  const description = project.description?.trim();
  if (description) {
    await tx
      .update(projectTable)
      .set({ description })
      .where(eq(projectTable.id, projectId));
  }

  const columnPlan = planImportColumns(project.columns);
  const board = await writeImportColumns(tx, projectId, columnPlan);
  const assignees = createAssigneeMatcher(
    await loadAssignableMembers(tx, workspaceId, projectId),
  );

  const { numbers, lastNumber } = assignImportTaskNumbers(project.tasks);
  if (lastNumber > 0) {
    await tx
      .update(projectTable)
      .set({
        lastTaskNumber: sql`GREATEST(${projectTable.lastTaskNumber}, ${lastNumber})`,
      })
      .where(eq(projectTable.id, projectId));
  }
  const tasks = planImportTasks({
    tasks: project.tasks,
    columns: board.byKey,
    fallbackColumn: board.fallback,
    numbers,
    now,
    newId: createId,
    assign: assignees.match,
  });
  await writeImportTasks(tx, projectId, userId, tasks);

  const labels = await writeImportLabels(
    tx,
    workspaceId,
    project.labels,
    tasks,
  );

  const comments = includeComments
    ? await writeImportComments(tx, {
        tasks,
        importedBy: userId,
        source,
        now,
      })
    : 0;

  const relations = await writeImportRelations(
    tx,
    planImportRelations(
      project.relations,
      new Map(tasks.map((task) => [task.key, task.id])),
    ),
  );

  const unmatched = assignees.warning();
  return {
    counts: {
      columns: board.count,
      tasks: tasks.length,
      labels,
      comments,
      assignees: tasks.filter((task) => task.userId).length,
      relations,
    },
    warnings: [
      ...project.warnings,
      ...columnPlan.warnings,
      ...(unmatched ? [unmatched] : []),
    ],
  };
}
