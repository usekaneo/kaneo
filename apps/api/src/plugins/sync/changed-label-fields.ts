import {
  extractIssuePriority,
  extractIssueStatus,
} from "../github/utils/extract-priority";
import { resumeLabelChanges } from "./resume-label-changes";

export const isFieldLabel = (name: string) =>
  name.startsWith("status:") || name.startsWith("priority:");

// Links synced before `known` was recorded fall back to every current label.
const added = (labels: string[], known: string[] | undefined, prefix: string) =>
  labels.filter(
    (name) => name.startsWith(prefix) && !(known ?? []).includes(name),
  );

/**
 * Status and priority set by the issue's current labels. `known` holds the
 * field labels last confirmed on the provider; only labels added since then
 * count, so echoes and redeliveries of the same labels change nothing.
 */
export function changedLabelFields(
  link: { id: string; metadata: string | null },
  labels: string[],
  known: string[] | undefined,
  task: { status: string; priority: string | null },
) {
  const resumed = resumeLabelChanges(link, labels);
  const status = resumed.statusChanged
    ? added(labels, known, "status:")
        .map((name) => extractIssueStatus([name]))
        .find((value) => value && value !== task.status)
    : undefined;
  const priority = resumed.priorityChanged
    ? added(labels, known, "priority:")
        .map((name) => extractIssuePriority([name]))
        .find((value) => value && value !== task.priority)
    : undefined;
  return { status: status ?? undefined, priority: priority ?? undefined };
}
