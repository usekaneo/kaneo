export type TaskRelationEdge = {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
};

export type SubtaskRow<T> = {
  task: T;
  /** Nesting level; 0 for a task in its own status group. */
  depth: number;
  /**
   * Unique per rendered row rather than per task. A child keeps its own
   * top-level row and is repeated under each parent, so `task.id` appears more
   * than once and cannot key a row or identify a drag target.
   */
  rowId: string;
  childCount: number;
};

/**
 * Maps each parent to its children, in the order the relations were returned.
 *
 * Hierarchy is a graph edge rather than a column on the task, so a task may
 * have several parents and the edges may form a cycle. Neither the schema nor
 * the create endpoint prevents it, so consumers must not assume a tree.
 */
export function buildSubtaskChildren(
  relations: readonly TaskRelationEdge[],
): Map<string, string[]> {
  const children = new Map<string, string[]>();

  for (const relation of relations) {
    if (relation.relationType !== "subtask") continue;
    if (relation.sourceTaskId === relation.targetTaskId) continue;

    const existing = children.get(relation.sourceTaskId);
    if (existing) {
      if (!existing.includes(relation.targetTaskId)) {
        existing.push(relation.targetTaskId);
      }
    } else {
      children.set(relation.sourceTaskId, [relation.targetTaskId]);
    }
  }

  return children;
}

/**
 * A task may have several parents, so expanding every occurrence enumerates
 * simple paths rather than tasks and can grow exponentially: twelve layers of
 * two tasks each, 24 tasks and 44 edges, reach 16,356 rows. Reaching that
 * needs a viewer to expand exponentially many rows by hand, since every row
 * starts collapsed and nested rows carry their own path ids rather than
 * inheriting their task's state. The cap is a backstop for the shapes that
 * would otherwise freeze the tab, not the mechanism that keeps the common
 * case small.
 */
const MAX_NESTED_ROWS = 1000;

/**
 * Expands a column's tasks into rows, repeating each subtask beneath its
 * parent when that parent is expanded.
 *
 * A child is not moved out of its own status group: it keeps its top-level row
 * and also appears, indented, under the parent. That leaves grouping, the
 * per-column counts and the existing drag targets untouched.
 */
export function flattenSubtaskRows<T extends { id: string }>({
  tasks,
  children,
  tasksById,
  isExpanded,
  maxNestedRows = MAX_NESTED_ROWS,
}: {
  tasks: readonly T[];
  children: Map<string, string[]>;
  tasksById: Map<string, T>;
  isExpanded: (rowId: string) => boolean;
  maxNestedRows?: number;
}): SubtaskRow<T>[] {
  const rows: SubtaskRow<T>[] = [];
  let nested = 0;

  const walk = (
    task: T,
    depth: number,
    ancestors: Set<string>,
    path: string,
  ) => {
    const rowId = path ? `${path}/${task.id}` : task.id;

    // Only children the view can actually render count; a subtask in another
    // project is not returned by the endpoint and must not show a chevron.
    const childTasks: T[] = [];
    for (const childId of children.get(task.id) ?? []) {
      const child = tasksById.get(childId);
      if (child && !ancestors.has(childId) && childId !== task.id) {
        childTasks.push(child);
      }
    }

    rows.push({ task, depth, rowId, childCount: childTasks.length });

    if (depth > 0) nested += 1;
    if (childTasks.length === 0 || !isExpanded(rowId)) return;
    if (nested >= maxNestedRows) return;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(task.id);
    for (const child of childTasks) {
      // Checked per child, not once per parent: a single parent with more
      // children than the budget would otherwise emit all of them.
      if (nested >= maxNestedRows) return;
      walk(child, depth + 1, nextAncestors, rowId);
    }
  };

  // Top-level rows are always emitted; the cap governs nesting only, because
  // the status grouping and the per-column counts depend on every task in the
  // column having a row.
  for (const task of tasks) {
    walk(task, 0, new Set(), "");
  }

  return rows;
}
