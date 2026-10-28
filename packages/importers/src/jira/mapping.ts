import { toIsoDate } from "../markdown.js";
import type {
  ImportedComment,
  ImportedPriority,
  ImportedTask,
} from "../types.js";
import type { JiraIssue } from "./api-types.js";
import type { HtmlToMarkdown } from "./html.js";
import { issueLabels } from "./labels.js";
import { toPerson } from "./people.js";

const PRIORITIES: ReadonlyMap<string, ImportedPriority> = new Map([
  ["highest", "urgent"],
  ["blocker", "urgent"],
  ["critical", "urgent"],
  ["high", "high"],
  ["major", "high"],
  ["medium", "medium"],
  ["low", "low"],
  ["minor", "low"],
  ["lowest", "low"],
  ["trivial", "low"],
]);

export type IssueContext = {
  columnKey: string | null;
  comments: ImportedComment[];
  toMarkdown: HtmlToMarkdown;
};

export function mapPriority(name: string | null | undefined): ImportedPriority {
  return PRIORITIES.get(name?.trim().toLowerCase() ?? "") ?? "no-priority";
}

export function issueNumber(
  key: string | null | undefined,
): number | undefined {
  const digits = /-(\d+)$/.exec(key?.trim() ?? "")?.[1];
  const number = digits ? Number(digits) : Number.NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

export function issueDescription(
  issue: JiraIssue,
  toMarkdown: HtmlToMarkdown,
): string {
  const rendered = issue.renderedFields?.description;
  if (typeof rendered === "string") return toMarkdown(rendered);
  const raw = issue.fields?.description;
  return typeof raw === "string" ? raw.trim() : "";
}

export function mapIssue(
  issue: JiraIssue,
  context: IssueContext,
): ImportedTask {
  const fields = issue.fields ?? {};
  const number = issueNumber(issue.key);
  const dueDate = toIsoDate(fields.duedate);
  const createdAt = toIsoDate(fields.created);
  const assignee = toPerson(fields.assignee);
  return {
    key: issue.id,
    ...(number !== undefined ? { number } : {}),
    columnKey: context.columnKey,
    title: fields.summary?.trim() || issue.key || "Untitled",
    description: issueDescription(issue, context.toMarkdown),
    priority: mapPriority(fields.priority?.name),
    ...(dueDate ? { dueDate } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(assignee ? { assignee } : {}),
    labelKeys: issueLabels(issue),
    comments: context.comments,
  };
}
