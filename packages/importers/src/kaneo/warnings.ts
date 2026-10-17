import type { ImportedTask } from "../types.js";
import type { KaneoBoardTask, KaneoMember } from "./client.js";

export type WarningFacts = {
  tasks: KaneoBoardTask[];
  imported: ImportedTask[];
  members: Map<string, KaneoMember>;
  customFieldNames: string[];
  relationsOutsideProject: number;
};

const ASSET_REFERENCE = /\/api\/asset\/[\w-]+/;

export const MEMBERS_UNAVAILABLE_WARNING =
  "Workspace members could not be read, so assignees and comment authors carry over by name only.";
export const RELATIONS_UNAVAILABLE_WARNING =
  "This Kaneo version does not expose task links, so they are not copied.";
export const COMMENTS_UNAVAILABLE_WARNING =
  "This Kaneo version does not expose comments, so they are not copied.";
export const CUSTOM_FIELDS_UNREADABLE_WARNING =
  "Custom fields could not be read with this API key, so they are not listed here.";

export function buildWarnings(facts: WarningFacts): string[] {
  const warnings: string[] = [];

  const unresolved = facts.tasks.filter(
    (task) => task.userId && !facts.members.get(task.userId)?.email?.trim(),
  ).length;
  if (unresolved > 0) {
    warnings.push(
      `${tasksHave(unresolved)} an assignee whose email address could not be found, so the assignee may not carry over.`,
    );
  }

  if (facts.customFieldNames.length > 0) {
    warnings.push(
      `Custom fields are not copied: ${facts.customFieldNames.join(", ")}.`,
    );
  }

  const withLinks = facts.tasks.filter(
    (task) => (task.externalLinks ?? []).length > 0,
  ).length;
  if (withLinks > 0) {
    warnings.push(
      `${tasksHave(withLinks)} integration links (such as GitHub issues) that are not copied.`,
    );
  }

  const withAssets = facts.imported.filter(referencesAssets).length;
  if (withAssets > 0) {
    warnings.push(
      `${count(withAssets, "task")} ${withAssets === 1 ? "references" : "reference"} images or files stored on the source instance. They are not copied and may not display.`,
    );
  }

  if (facts.relationsOutsideProject > 0) {
    warnings.push(
      `${count(facts.relationsOutsideProject, "task link")} ${facts.relationsOutsideProject === 1 ? "points" : "point"} to tasks in other projects and ${facts.relationsOutsideProject === 1 ? "is" : "are"} not copied.`,
    );
  }

  return warnings;
}

function referencesAssets(task: ImportedTask): boolean {
  return (
    ASSET_REFERENCE.test(task.description) ||
    task.comments.some((comment) => ASSET_REFERENCE.test(comment.body))
  );
}

function tasksHave(n: number): string {
  return `${count(n, "task")} ${n === 1 ? "has" : "have"}`;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
