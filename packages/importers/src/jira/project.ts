import type { ImportedProject } from "../types.js";
import type {
  JiraBoardColumn,
  JiraComment,
  JiraIssue,
  JiraIssueTypeStatuses,
  JiraProject,
  JiraStatus,
} from "./api-types.js";
import {
  type ColumnPlan,
  collectStatuses,
  planBoardColumns,
  planStatusColumns,
  resolveColumnKey,
  type StatusCategories,
  statusCategories,
} from "./columns.js";
import { mapComments } from "./comments.js";
import { createJiraHtmlToMarkdown } from "./html.js";
import { mapLabels } from "./labels.js";
import { mapIssue } from "./mapping.js";
import { mapRelations } from "./relations.js";
import { buildWarnings } from "./warnings.js";

export type JiraProjectData = {
  baseUrl: string;
  project: JiraProject;
  statusGroups: JiraIssueTypeStatuses[];
  boardColumns: JiraBoardColumn[] | null;
  boardUnavailable: boolean;
  issues: JiraIssue[];
  comments: ReadonlyMap<string, JiraComment[]>;
};

export function mapJiraProject(data: JiraProjectData): ImportedProject {
  const statuses = collectStatuses(data.statusGroups, data.issues);
  const categories = statusCategories(statuses);
  const plan = choosePlan(data.boardColumns, statuses, categories);
  const toMarkdown = createJiraHtmlToMarkdown(data.baseUrl);
  const placed = sortByColumn(data.issues, plan, categories);
  const { relations, external } = mapRelations(data.issues);
  const description = data.project.description?.trim();

  return {
    name: data.project.name?.trim() || data.project.key,
    key: data.project.key,
    ...(description ? { description } : {}),
    columns: plan.columns,
    labels: mapLabels(data.issues),
    tasks: placed.map(({ issue, columnKey }) =>
      mapIssue(issue, {
        columnKey,
        comments: mapComments(data.comments.get(issue.id) ?? [], toMarkdown),
        toMarkdown,
      }),
    ),
    relations,
    warnings: buildWarnings({
      issuesWithAttachments: data.issues.filter(
        (issue) => (issue.fields?.attachment?.length ?? 0) > 0,
      ).length,
      externalLinks: external,
      boardUnavailable: data.boardUnavailable,
    }),
  };
}

function choosePlan(
  boardColumns: JiraBoardColumn[] | null,
  statuses: JiraStatus[],
  categories: StatusCategories,
): ColumnPlan {
  const board = boardColumns
    ? planBoardColumns(boardColumns, categories)
    : null;
  return board && board.columns.length > 0
    ? board
    : planStatusColumns(statuses);
}

function sortByColumn(
  issues: JiraIssue[],
  plan: ColumnPlan,
  categories: StatusCategories,
): Array<{ issue: JiraIssue; columnKey: string | null }> {
  const rank = new Map(
    plan.columns.map((column, index) => [column.key, index]),
  );
  return issues
    .map((issue, index) => ({
      issue,
      index,
      columnKey: resolveColumnKey(plan, issue.fields?.status?.id, categories),
    }))
    .sort(
      (a, b) =>
        columnRank(a.columnKey, rank) - columnRank(b.columnKey, rank) ||
        a.index - b.index,
    );
}

function columnRank(
  columnKey: string | null,
  rank: ReadonlyMap<string, number>,
): number {
  return columnKey === null ? -1 : (rank.get(columnKey) ?? rank.size);
}
