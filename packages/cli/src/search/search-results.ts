import type { SearchHit, SearchType } from "../api/search.js";
import { plainText } from "../projects/description-preview.js";
import { projectUrl, taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";

export const RESULT_TYPES = [
  "task",
  "project",
  "comment",
  "activity",
  "workspace",
] as const;
export type SearchResultType = (typeof RESULT_TYPES)[number];

export type SearchResultJson = {
  readonly type: SearchResultType;
  readonly id: string;
  readonly title: string;
  readonly ticketId: string | null;
  readonly status: string | null;
  readonly priority: string | null;
  readonly snippet: string | null;
  readonly projectId: string | null;
  readonly projectKey: string | null;
  readonly projectName: string | null;
  readonly workspaceId: string;
  readonly assignee: string | null;
  readonly author: string | null;
  readonly createdAt: string;
  readonly url: string | null;
};

export type SearchContext = {
  readonly type: SearchType;
  readonly workspaceId: string;
  readonly workspaceSlug: string | null;
  readonly projectId?: string | undefined;
  readonly webUrl: string;
};

const ALLOWED: Readonly<Record<SearchType, ReadonlyArray<SearchResultType>>> = {
  all: RESULT_TYPES,
  tasks: ["task"],
  projects: ["project"],
  workspaces: ["workspace"],
  comments: ["comment"],
  activities: ["activity"],
};

const SNIPPET_LENGTH = 200;

export function snippet(value: string | undefined): string | null {
  if (!value) return null;
  const flat = plainText(value).replace(/\s+/gu, " ").trim();
  if (flat === "") return null;
  const characters = [...flat];
  return characters.length > SNIPPET_LENGTH
    ? `${characters
        .slice(0, SNIPPET_LENGTH - 1)
        .join("")
        .trimEnd()}…`
    : flat;
}

function isResultType(type: string): type is SearchResultType {
  return (RESULT_TYPES as ReadonlyArray<string>).includes(type);
}

function resultUrl(
  type: SearchResultType,
  hit: SearchHit,
  ticket: string | null,
  context: SearchContext,
): string | null {
  const { webUrl, workspaceId, workspaceSlug } = context;
  switch (type) {
    case "task":
      return hit.projectId
        ? taskUrl(webUrl, { workspaceId, projectId: hit.projectId, id: hit.id })
        : null;
    case "project":
      return projectUrl(webUrl, { workspaceId, id: hit.id });
    case "workspace":
      return `${webUrl}/dashboard/workspace/${hit.id}`;
    case "comment":
    case "activity":
      if (ticket && workspaceSlug) {
        return `${webUrl}/${encodeURIComponent(workspaceSlug)}/task/${encodeURIComponent(ticket)}`;
      }
      return hit.projectId
        ? projectUrl(webUrl, { workspaceId, id: hit.projectId })
        : null;
  }
}

function inProject(
  type: SearchResultType,
  hit: SearchHit,
  projectId: string | undefined,
): boolean {
  if (projectId === undefined) return true;
  if (type === "workspace") return false;
  return (type === "project" ? hit.id : hit.projectId) === projectId;
}

export function normalizeSearchResults(
  hits: ReadonlyArray<SearchHit>,
  context: SearchContext,
): SearchResultJson[] {
  const allowed = ALLOWED[context.type];
  const seen = new Set<string>();
  const results: SearchResultJson[] = [];
  for (const hit of hits) {
    const { type } = hit;
    if (!isResultType(type) || !allowed.includes(type)) continue;
    if (
      hit.workspaceId !== undefined &&
      hit.workspaceId !== context.workspaceId
    )
      continue;
    if (!inProject(type, hit, context.projectId)) continue;
    const key = `${type}:${hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ticket =
      type === "project" || type === "workspace" || !hit.projectSlug
        ? null
        : ticketId(hit.projectSlug, hit.taskNumber ?? null);
    results.push({
      type,
      id: hit.id,
      title: hit.title,
      ticketId: ticket,
      status: hit.status ?? null,
      priority: hit.priority ?? null,
      snippet: snippet(
        type === "comment" || type === "activity"
          ? hit.content
          : hit.description,
      ),
      projectId: hit.projectId ?? null,
      projectKey: hit.projectSlug ? hit.projectSlug.toUpperCase() : null,
      projectName: hit.projectName ?? null,
      workspaceId: context.workspaceId,
      assignee: type === "task" ? (hit.userName ?? null) : null,
      author:
        type === "comment" || type === "activity"
          ? (hit.userName ?? null)
          : null,
      createdAt: hit.createdAt,
      url: resultUrl(type, hit, ticket, context),
    });
  }
  return results;
}
