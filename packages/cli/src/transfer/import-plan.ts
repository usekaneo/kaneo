import type { ImportTaskBody } from "../api/export-import.js";
import type { Column } from "../api/schemas.js";
import { matchColumn } from "../tasks/match-column.js";
import type { ImportCandidate } from "./parse-import-file.js";

const VIRTUAL_STATUSES = ["planned", "archived"];

export type StatusRemap = { readonly from: string; readonly to: string };

export type ImportPlan = {
  readonly tasks: ReadonlyArray<ImportTaskBody>;
  readonly remapped: ReadonlyArray<StatusRemap>;
  readonly unknown: ReadonlyArray<{
    readonly status: string;
    readonly count: number;
  }>;
  readonly withLabels: number;
};

function resolveStatus(
  status: string | undefined,
  columns: ReadonlyArray<Column>,
  fallback: string,
): { readonly slug: string; readonly known: boolean } {
  if (status === undefined) return { slug: fallback, known: true };
  if (
    VIRTUAL_STATUSES.includes(status) ||
    columns.some((column) => column.slug === status)
  ) {
    return { slug: status, known: true };
  }
  const match = matchColumn(columns, status);
  return match
    ? { slug: match.slug, known: true }
    : { slug: status, known: false };
}

export function planImport(
  candidates: ReadonlyArray<ImportCandidate>,
  columns: ReadonlyArray<Column>,
): ImportPlan {
  const ordered = [...columns].sort((a, b) => a.position - b.position);
  const fallback = ordered[0]?.slug ?? "planned";
  const remapped = new Map<string, string>();
  const unknown = new Map<string, number>();
  const tasks = candidates.map((candidate): ImportTaskBody => {
    const { slug, known } = resolveStatus(candidate.status, ordered, fallback);
    if (!known) unknown.set(slug, (unknown.get(slug) ?? 0) + 1);
    else if (candidate.status !== undefined && slug !== candidate.status) {
      remapped.set(candidate.status, slug);
    }
    return {
      title: candidate.title,
      status: slug,
      ...(candidate.description === undefined
        ? {}
        : { description: candidate.description }),
      ...(candidate.priority === undefined
        ? {}
        : { priority: candidate.priority }),
      ...(candidate.startDate === undefined
        ? {}
        : { startDate: candidate.startDate }),
      ...(candidate.dueDate === undefined
        ? {}
        : { dueDate: candidate.dueDate }),
      ...(candidate.userId === undefined ? {} : { userId: candidate.userId }),
    };
  });
  return {
    tasks,
    remapped: [...remapped].map(([from, to]) => ({ from, to })),
    unknown: [...unknown].map(([status, count]) => ({ status, count })),
    withLabels: candidates.filter((candidate) => candidate.labels > 0).length,
  };
}
