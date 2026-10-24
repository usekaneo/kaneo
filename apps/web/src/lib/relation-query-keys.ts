/**
 * Matches every per-task relation query while excluding the project-scoped one.
 *
 * The two live under the same `task-relations` prefix but answer different
 * questions. A per-task response embeds each linked task's title, status and
 * assignee, so an ordinary task edit stales it. The project response is edges
 * alone — ids and relation types — and changes only when a relation is created
 * or removed, or a task joins or leaves the project. A plain prefix
 * invalidation cannot tell them apart and refetches the project query on every
 * status or assignee change.
 */
export function isPerTaskRelationQuery(query: {
  queryKey: readonly unknown[];
}) {
  return (
    query.queryKey[0] === "task-relations" && query.queryKey[1] !== "project"
  );
}
