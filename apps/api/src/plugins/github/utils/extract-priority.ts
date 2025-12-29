type GitHubLabel = string | { name?: string };

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const VALID_STATUSES = [
  "to-do",
  "in-progress",
  "in-review",
  "done",
  "planned",
  "archived",
] as const;

export type ValidPriority = (typeof VALID_PRIORITIES)[number];
export type ValidStatus = (typeof VALID_STATUSES)[number];

/**
 * Extract priority from GitHub issue labels.
 * Returns null if no valid priority label found (lets Kaneo use its defaults).
 */
export function extractIssuePriority(
  labels: GitHubLabel[] | undefined,
): ValidPriority | null {
  if (!labels) return null;

  const priorityLabels = labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name) => name?.startsWith("priority:"));

  const firstPriorityLabel = priorityLabels[0];
  if (!firstPriorityLabel) return null;

  const priority = firstPriorityLabel.replace("priority:", "");
  return VALID_PRIORITIES.includes(priority as ValidPriority)
    ? (priority as ValidPriority)
    : null;
}

/**
 * Extract status from GitHub issue labels.
 * Returns null if no valid status label found (lets Kaneo use its defaults).
 */
export function extractIssueStatus(
  labels: GitHubLabel[] | undefined,
): ValidStatus | null {
  if (!labels) return null;

  const statusLabels = labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name) => name?.startsWith("status:"));

  const firstStatusLabel = statusLabels[0];
  if (!firstStatusLabel) return null;

  const status = firstStatusLabel.replace("status:", "");
  return VALID_STATUSES.includes(status as ValidStatus)
    ? (status as ValidStatus)
    : null;
}
