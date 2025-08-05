type GitHubLabel = string | { name?: string };

export function extractIssuePriority(
  labels: GitHubLabel[] | undefined,
): string {
  if (!labels) return "medium";

  const priorityLabels = labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name) => name?.startsWith("priority:"));

  const firstPriorityLabel = priorityLabels[0];
  const priority = firstPriorityLabel?.replace("priority:", "") || "medium";

  const validPriorities = ["low", "medium", "high", "urgent"];
  return validPriorities.includes(priority) ? priority : "medium";
}

export function extractIssueStatus(labels: GitHubLabel[] | undefined): string {
  if (!labels) return "to-do";

  const statusLabels = labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name) => name?.startsWith("status:"));

  const firstStatusLabel = statusLabels[0];
  const status = firstStatusLabel?.replace("status:", "") || "to-do";

  const validStatuses = ["to-do", "in-progress", "done", "planned", "archived"];
  return validStatuses.includes(status) ? status : "to-do";
}
