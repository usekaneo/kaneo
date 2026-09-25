// Pure hierarchy/rollup math for the Gantt "subtask" summary-bar feature.
// Kept free of React and the DOM, like the rest of this folder's pure
// modules (dependency-lines.ts, timeline.ts, ...), so it's unit-testable
// directly.
//
// ONE LEVEL OF NESTING: a task is either a summary parent or a nested child,
// never both. A "subtask" relation's source is the parent and its target is
// the child (see task-subtasks.tsx, which creates the relation as
// `{ sourceTaskId: <the task whose subtasks panel this is>, targetTaskId:
// <the new subtask> }`). If a child task itself has "subtask" relations
// pointing at further tasks (a grandchild), that deeper relation is not
// reflected here: the grandchild still renders as an ordinary top-level
// Gantt row, it's simply never folded into any ancestor's summary bar or
// indentation. This keeps the hierarchy a single, obvious level rather than
// an arbitrarily deep (and, for a cyclic/corrupted relation graph,
// potentially infinite) tree.

export type SubtaskRelationInput = {
  sourceTaskId: string;
  targetTaskId: string;
};

export type GanttHierarchy = {
  /** Parent task id -> its direct child task ids, in relation order,
   * deduped. Only present for a task that both heads at least one "subtask"
   * relation and is not itself a subtask of another task. */
  childrenByParentId: Map<string, string[]>;
  /** Child task id -> its (one-level) parent task id. */
  parentIdByChildId: Map<string, string>;
};

export function buildTaskHierarchy(
  taskIds: Iterable<string>,
  subtaskRelations: readonly SubtaskRelationInput[],
): GanttHierarchy {
  const knownIds = new Set(taskIds);

  // Every id that is some relation's target, restricted to relations between
  // two tasks we actually know about (a relation reaching outside this
  // project's own task list has no row to attach to here).
  const targetIds = new Set<string>();
  for (const relation of subtaskRelations) {
    if (
      knownIds.has(relation.sourceTaskId) &&
      knownIds.has(relation.targetTaskId)
    ) {
      targetIds.add(relation.targetTaskId);
    }
  }

  const childrenByParentId = new Map<string, string[]>();
  const parentIdByChildId = new Map<string, string>();

  for (const relation of subtaskRelations) {
    const parentId = relation.sourceTaskId;
    const childId = relation.targetTaskId;
    if (!knownIds.has(parentId) || !knownIds.has(childId)) continue;
    // Enforces the one-level limit documented above: a task that is itself
    // someone else's subtask cannot also head its own summary row.
    if (targetIds.has(parentId)) continue;
    // A child claimed by an earlier relation keeps its first parent — a
    // subtask normally has exactly one, this only guards a corrupted graph.
    if (parentIdByChildId.has(childId)) continue;

    parentIdByChildId.set(childId, parentId);
    const siblings = childrenByParentId.get(parentId);
    if (siblings) siblings.push(childId);
    else childrenByParentId.set(parentId, [childId]);
  }

  return { childrenByParentId, parentIdByChildId };
}

export type ScheduleSpan = { start: Date; end: Date };

/** Classic Gantt summary rollup: a parent's bar spans the earliest child
 * start to the latest child due date. Returns null for no children at all
 * (nothing to roll up), the same as an ordinary task with no dates. */
export function computeSummarySpan(
  childSpans: readonly ScheduleSpan[],
): ScheduleSpan | null {
  if (childSpans.length === 0) return null;
  let start = childSpans[0].start;
  let end = childSpans[0].end;
  for (const span of childSpans) {
    if (span.start < start) start = span.start;
    if (span.end > end) end = span.end;
  }
  return { start, end };
}

/** Every parent's rolled-up span, keyed by parent task id, computed only
 * from the children that have their own derivable schedule (a child with
 * neither startDate nor dueDate contributes nothing, same as it would as an
 * ordinary standalone row). A parent that has its own startDate/dueDate is
 * still overridden by this span once it has at least one spanned child —
 * see the Gantt route, which applies that override — so the summary always
 * reads as "the span of its children", never a mix of the two. */
export function computeParentSummarySpans(
  hierarchy: GanttHierarchy,
  ownSpanByTaskId: ReadonlyMap<string, ScheduleSpan>,
): Map<string, ScheduleSpan> {
  const spans = new Map<string, ScheduleSpan>();
  for (const [parentId, childIds] of hierarchy.childrenByParentId) {
    const childSpans: ScheduleSpan[] = [];
    for (const childId of childIds) {
      const span = ownSpanByTaskId.get(childId);
      if (span) childSpans.push(span);
    }
    const summary = computeSummarySpan(childSpans);
    if (summary) spans.set(parentId, summary);
  }
  return spans;
}

export type GanttRowLike = {
  id: string;
  scheduleStart: Date;
};

/**
 * Places each parent's children directly after it in display order, instead
 * of interleaving them into the flat chronological sort used for top-level
 * rows — so an indented child always visually sits under its own parent
 * regardless of how its dates compare to unrelated rows in between it and
 * the parent's chronological neighbors.
 *
 * A collapsed parent's children (`collapsedParentIds`) are left out of the
 * result entirely, rather than rendered hidden — the same "no box for this
 * row" state an out-of-window or search-filtered row already produces
 * elsewhere in the Gantt, so a dependency line touching a hidden child is
 * simply not drawn (see dependency-lines.ts, which already skips any edge
 * missing either endpoint's box) instead of needing a dangling-line special
 * case of its own.
 */
export function flattenGanttRows<T extends GanttRowLike>(
  topLevelRowsChronological: readonly T[],
  childRowsByParentId: ReadonlyMap<string, readonly T[]>,
  collapsedParentIds: ReadonlySet<string>,
): T[] {
  const result: T[] = [];
  for (const row of topLevelRowsChronological) {
    result.push(row);
    if (collapsedParentIds.has(row.id)) continue;
    const children = childRowsByParentId.get(row.id);
    if (!children || children.length === 0) continue;
    result.push(
      ...[...children].sort(
        (left, right) =>
          left.scheduleStart.getTime() - right.scheduleStart.getTime(),
      ),
    );
  }
  return result;
}
