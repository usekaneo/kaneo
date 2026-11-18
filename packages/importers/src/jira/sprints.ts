import { SourceHttpError } from "../http.js";
import type { ImportedSprint, ImportedSprintStatus } from "../types.js";
import type { JiraSprint } from "./api-types.js";
import type { JiraClient } from "./client.js";

export const SPRINTS_UNAVAILABLE_WARNING =
  "Jira did not share the sprints for this project, so they were not imported.";

const NO_SPRINT_ACCESS = new Set([401, 403, 404]);

export type SprintsRead = {
  sprints: ImportedSprint[];
  // Issue id to the sprint it belongs to; later sprints win.
  issueSprint: ReadonlyMap<string, string>;
  warning: string | null;
};

export function mapSprintStatus(
  state: string | null | undefined,
): ImportedSprintStatus {
  const value = state?.trim().toLowerCase();
  return value === "active"
    ? "active"
    : value === "closed"
      ? "closed"
      : "future";
}

export function toImportedSprint(sprint: JiraSprint): ImportedSprint {
  return {
    key: String(sprint.id),
    name: sprint.name?.trim() || `Sprint ${sprint.id}`,
    status: mapSprintStatus(sprint.state),
    ...(sprint.goal?.trim() ? { goal: sprint.goal.trim() } : {}),
    ...(sprint.startDate ? { startDate: sprint.startDate } : {}),
    ...(sprint.endDate ? { endDate: sprint.endDate } : {}),
  };
}

// Jira reports an issue in every sprint it still belongs to, so the sprints are
// read in start order and later assignments win: an issue moved from a closed
// sprint into the active one ends up in the active sprint.
export async function readBoardSprints(
  client: JiraClient,
  boardId: number,
  onProgress?: (message: string) => void,
): Promise<SprintsRead> {
  let sprints: JiraSprint[];
  try {
    sprints = await readAllSprints(client, boardId);
  } catch (error) {
    if (deniedStatus(error) === undefined) throw error;
    return {
      sprints: [],
      issueSprint: new Map(),
      warning: SPRINTS_UNAVAILABLE_WARNING,
    };
  }

  const ordered = [...sprints].sort(
    (a, b) =>
      Date.parse(a.startDate ?? "") - Date.parse(b.startDate ?? "") ||
      a.id - b.id,
  );

  const issueSprint = new Map<string, string>();
  for (const [index, sprint] of ordered.entries()) {
    const issues = await readSprintIssues(client, String(sprint.id));
    for (const issue of issues) {
      if (issue.id) issueSprint.set(String(issue.id), String(sprint.id));
    }
    const done = index + 1;
    if (done % 10 === 0 || done === ordered.length) {
      onProgress?.(`Reading sprints (${done} of ${ordered.length})`);
    }
  }

  return {
    sprints: sprints.map(toImportedSprint),
    issueSprint,
    warning: null,
  };
}

async function readAllSprints(
  client: JiraClient,
  boardId: number,
): Promise<JiraSprint[]> {
  const sprints: JiraSprint[] = [];
  for (;;) {
    const page = await client.boardSprints(boardId, sprints.length);
    const batch = page?.values ?? [];
    sprints.push(...batch);
    if (batch.length === 0 || page?.isLast === true) return sprints;
  }
}

async function readSprintIssues(
  client: JiraClient,
  sprintId: string,
): Promise<Array<{ id?: string | number | null }>> {
  const issues: Array<{ id?: string | number | null }> = [];
  try {
    for (;;) {
      const page = await client.sprintIssues(sprintId, issues.length);
      // The agile issue search wraps its page in "issues", unlike the sprint
      // pages that use "values".
      const batch = page?.issues ?? page?.values ?? [];
      issues.push(...batch);
      if (batch.length === 0 || page?.isLast === true) return issues;
    }
  } catch (error) {
    if (deniedStatus(error) === undefined) throw error;
    // shortcut: one unreadable sprint only drops its own assignments
    return [];
  }
}

function deniedStatus(error: unknown): number | undefined {
  return error instanceof SourceHttpError && NO_SPRINT_ACCESS.has(error.status)
    ? error.status
    : undefined;
}
