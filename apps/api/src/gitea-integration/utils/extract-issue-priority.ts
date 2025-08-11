type GiteaLabel = string | { name?: string };

export function extractIssuePriority(labels: GiteaLabel[] | undefined): string {
  if (!labels) return "medium";

  const priorityLabels = labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name) => name?.startsWith("priority:"));

  const firstPriorityLabel = priorityLabels[0];
  const priority = firstPriorityLabel?.replace("priority:", "") || "medium";

  const validPriorities = ["low", "medium", "high", "urgent"];
  return validPriorities.includes(priority) ? priority : "medium";
}

export function extractIssueStatus(labels: GiteaLabel[] | undefined): string {
  if (!labels) return "to-do";

  const statusLabels = labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name) => name?.startsWith("status:"));

  const firstStatusLabel = statusLabels[0];
  const status = firstStatusLabel?.replace("status:", "") || "to-do";

  const validStatuses = [
    "to-do",
    "in-progress",
    "done",
    "planned",
    "in-review",
    "archived",
  ] as const;

  type ValidStatus = (typeof validStatuses)[number];
  return validStatuses.includes(status as ValidStatus) ? status : "to-do";
}
