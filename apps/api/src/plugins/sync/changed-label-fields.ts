import {
  extractIssuePriority,
  extractIssueStatus,
} from "../github/utils/extract-priority";
import { resumeLabelChanges } from "./resume-label-changes";

/** Fields that the issue's current labels set to a value the task lacks. */
export function changedLabelFields(
  link: { id: string; metadata: string | null },
  labels: string[],
  task: { status: string; priority: string | null },
) {
  const changes = resumeLabelChanges(link, labels);
  // Prefer a label the task doesn't have, so adding a status label next to
  // the synced one still changes the task.
  const status = labels
    .map((name) => extractIssueStatus([name]))
    .find((value) => value && value !== task.status);
  const priority = labels
    .map((name) => extractIssuePriority([name]))
    .find((value) => value && value !== task.priority);
  return {
    status: changes.statusChanged ? status : undefined,
    priority: changes.priorityChanged ? priority : undefined,
  };
}
