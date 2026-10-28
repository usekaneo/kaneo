import {
  extractIssuePriority,
  extractIssueStatus,
} from "../github/utils/extract-priority";

/**
 * Status and priority set by the issue's current labels. `known` holds the
 * field labels Kaneo has accounted for; only labels added since then count,
 * so echoes and redeliveries of the same labels change nothing.
 */
export function changedLabelFields(
  labels: string[],
  known: string[],
  task: { status: string; priority: string | null },
) {
  const added = (prefix: string) =>
    labels.filter((name) => name.startsWith(prefix) && !known.includes(name));
  const status = added("status:")
    .map((name) => extractIssueStatus([name]))
    .find((value) => value && value !== task.status);
  const priority = added("priority:")
    .map((name) => extractIssuePriority([name]))
    .find((value) => value && value !== task.priority);
  return { status: status ?? undefined, priority: priority ?? undefined };
}
