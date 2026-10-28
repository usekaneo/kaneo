import { toIsoDate } from "../markdown.js";
import type {
  ImportedComment,
  ImportedPriority,
  ImportedProject,
  ImportedTask,
} from "../types.js";
import type {
  LinearComment,
  LinearIssue,
  LinearTeam,
  LinearWorkflowState,
} from "./client.js";
import { mapColumns, orderStates } from "./columns.js";
import { groupComments } from "./comments.js";
import { mapLabels } from "./labels.js";
import { toPerson } from "./people.js";
import { LABELS_PER_ISSUE, RELATIONS_PER_ISSUE } from "./queries.js";
import { mapRelations } from "./relations.js";

const PRIORITIES: Record<number, ImportedPriority> = {
  1: "urgent",
  2: "high",
  3: "medium",
  4: "low",
};

export function mapPriority(
  priority: number | null | undefined,
): ImportedPriority {
  return (priority != null && PRIORITIES[priority]) || "no-priority";
}

export function sortIssues(
  issues: LinearIssue[],
  states: LinearWorkflowState[],
): LinearIssue[] {
  const rank = new Map(
    orderStates(states).map((state, index) => [state.id, index]),
  );
  const rankOf = (issue: LinearIssue) =>
    (issue.state && rank.get(issue.state.id)) ?? states.length;
  return [...issues].sort(
    (a, b) => rankOf(a) - rankOf(b) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

export function mapIssue(
  issue: LinearIssue,
  columnKeys: ReadonlySet<string>,
  comments: ImportedComment[],
): ImportedTask {
  const stateId = issue.state?.id;
  const dueDate = toIsoDate(issue.dueDate);
  const createdAt = toIsoDate(issue.createdAt);
  const assignee = toPerson(issue.assignee);
  return {
    key: issue.id,
    number: issue.number,
    columnKey: stateId && columnKeys.has(stateId) ? stateId : null,
    title: issue.title,
    description: issue.description ?? "",
    priority: mapPriority(issue.priority),
    ...(dueDate ? { dueDate } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(assignee ? { assignee } : {}),
    labelKeys: issue.labels.nodes.map((label) => label.id),
    comments,
  };
}

export function buildWarnings(issues: LinearIssue[]): string[] {
  const warnings: string[] = [];
  const manyLabels = issues.filter(
    (issue) => issue.labels.pageInfo.hasNextPage,
  ).length;
  if (manyLabels > 0) {
    warnings.push(
      `${issueCount(manyLabels)} had more than ${LABELS_PER_ISSUE} labels; only the first ${LABELS_PER_ISSUE} were imported.`,
    );
  }
  const manyRelations = issues.filter(
    (issue) => issue.relations.pageInfo.hasNextPage,
  ).length;
  if (manyRelations > 0) {
    warnings.push(
      `${issueCount(manyRelations)} had more than ${RELATIONS_PER_ISSUE} linked issues; only the first ${RELATIONS_PER_ISSUE} links were imported.`,
    );
  }
  return warnings;
}

export function mapTeam(
  team: LinearTeam,
  issues: LinearIssue[],
  comments: LinearComment[],
): ImportedProject {
  const states = team.states.nodes;
  const usedStateIds = new Set(
    issues.flatMap((issue) => (issue.state ? [issue.state.id] : [])),
  );
  const columns = mapColumns(states, usedStateIds);
  const columnKeys = new Set(columns.map((column) => column.key));
  const commentsByIssue = groupComments(comments);
  const description = team.description?.trim();

  return {
    name: team.name,
    key: team.key,
    ...(description ? { description } : {}),
    columns,
    labels: mapLabels(issues),
    tasks: sortIssues(issues, states).map((issue) =>
      mapIssue(issue, columnKeys, commentsByIssue.get(issue.id) ?? []),
    ),
    relations: mapRelations(issues),
    warnings: buildWarnings(issues),
  };
}

function issueCount(count: number): string {
  return count === 1 ? "1 issue" : `${count} issues`;
}
