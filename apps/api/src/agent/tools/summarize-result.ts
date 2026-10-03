export function summarizeToolResult(name: string, result: unknown): string {
  if (name === "propose_change") return "Saved a change for review";
  if (name === "get_task") return "Read task details and recent comments";
  if (Array.isArray(result)) {
    if (name === "list_projects") return `Read ${result.length} projects`;
    if (name === "list_members") return `Read ${result.length} members`;
    if (name === "workload")
      return `Counted work for ${result.length} assignee groups`;
  }
  if (
    name === "list_tasks" &&
    result &&
    typeof result === "object" &&
    "tasks" in result &&
    Array.isArray(result.tasks)
  ) {
    const more = "nextOffset" in result && result.nextOffset !== null;
    return `Read ${result.tasks.length} tasks${more ? "; more pages available" : "; end of list"}`;
  }
  return "Read scoped workspace data";
}
