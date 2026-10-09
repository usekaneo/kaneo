import type { ImportOutcome } from "../api/export-import.js";
import type { Column } from "../api/schemas.js";
import { projectUrl, taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import type { ImportPlan, StatusRemap } from "./import-plan.js";

export type ImportTaskReport = {
  readonly index: number;
  readonly title: string;
  readonly status: string;
  readonly statusName: string;
  readonly imported: boolean | null;
  readonly id: string | null;
  readonly ticketId: string | null;
  readonly url: string | null;
  readonly error: string | null;
  readonly warnings: ReadonlyArray<string>;
};

export type ImportReportJson = {
  readonly project: {
    readonly id: string;
    readonly key: string;
    readonly name: string;
    readonly url: string;
  };
  readonly dryRun: boolean;
  readonly total: number;
  readonly imported: number;
  readonly failed: number;
  readonly unknownStatuses: ReadonlyArray<string>;
  readonly remappedStatuses: ReadonlyArray<StatusRemap>;
  readonly tasksWithLabels: number;
  readonly tasks: ReadonlyArray<ImportTaskReport>;
};

export type ImportTarget = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly workspaceId: string;
};

function statusName(columns: ReadonlyArray<Column>, slug: string): string {
  const column = columns.find((candidate) => candidate.slug === slug);
  if (column) return column.name;
  return slug === "archived" ? "Archived" : "Planned";
}

export function buildImportReport(input: {
  readonly project: ImportTarget;
  readonly columns: ReadonlyArray<Column>;
  readonly webUrl: string;
  readonly plan: ImportPlan;
  readonly outcomes: ReadonlyArray<ImportOutcome> | null;
}): ImportReportJson {
  const { project, plan, outcomes } = input;
  const tasks = plan.tasks.map((task, index): ImportTaskReport => {
    const outcome = outcomes?.[index];
    const id = outcome?.success ? (outcome.task.id ?? null) : null;
    const status = outcome?.success
      ? (outcome.task.status ?? task.status)
      : task.status;
    return {
      index: index + 1,
      title: task.title,
      status,
      statusName: statusName(input.columns, status),
      imported: outcome === undefined ? null : outcome.success,
      id,
      ticketId:
        outcome?.success && outcome.task.number !== undefined
          ? ticketId(project.slug, outcome.task.number)
          : null,
      url: id
        ? taskUrl(input.webUrl, {
            workspaceId: project.workspaceId,
            projectId: project.id,
            id,
          })
        : null,
      error:
        outcome && !outcome.success
          ? (outcome.error ?? "The server did not import this task.")
          : null,
      warnings: outcome?.warnings ?? [],
    };
  });
  const imported = tasks.filter((task) => task.imported === true).length;
  return {
    project: {
      id: project.id,
      key: project.slug.toUpperCase(),
      name: project.name,
      url: projectUrl(input.webUrl, project),
    },
    dryRun: outcomes === null,
    total: tasks.length,
    imported,
    failed: tasks.filter((task) => task.imported === false).length,
    unknownStatuses: plan.unknown.map((entry) => entry.status),
    remappedStatuses: plan.remapped,
    tasksWithLabels: plan.withLabels,
    tasks,
  };
}
