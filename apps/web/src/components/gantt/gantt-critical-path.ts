// Pure Critical Path Method (CPM) over the Gantt's "blocks" dependency
// network. Kept free of React and the DOM — like dependency-lines.ts and
// gantt-dependency-cascade.ts — so the slack math is unit-testable directly.
//
// SCOPE: tasks here already have FIXED start/due dates (this Gantt never lets
// CPM invent a schedule); the network is only used to work out how much
// slack each task's own fixed span currently has, so the UI can highlight
// the chain that has none. Only "blocks" edges constrain scheduling (mirrors
// gantt-dependency-cascade.ts) — callers must filter out "related"/"subtask"
// edges before calling this, and must only pass this project's own tasks
// that actually have a schedule: a cross-project task has no row to
// highlight here, and a dateless task has no duration to reason about, so
// neither participates (an edge touching either is simply dropped, the same
// "no box, no data" rule the rest of the Gantt already applies).
//
// MODEL — forward pass (earliest start/finish) then backward pass (latest
// start/finish), exactly like a textbook CPM, with one adaptation for a
// schedule whose dates are already fixed rather than computed from scratch:
//  - A task's DURATION is the whole-day length of its own fixed span
//    (dueDate - startDate). A milestone (start === due) has duration 0.
//  - EARLIEST START (ES): a task with no in-scope incoming "blocks" edge is
//    a graph ROOT, anchored at its own actual start (there's nothing else to
//    anchor a root to). A task WITH incoming edges gets its ES purely from
//    those edges — the max, over every incoming edge, of the earliest start
//    that edge's type + lag allows given the source's own (already
//    computed) ES/EF. This intentionally does NOT floor at the task's own
//    actual start: if its real date is later than the network requires,
//    that gap IS the slack this feature surfaces.
//  - EARLIEST FINISH (EF) = ES + duration.
//  - LATEST FINISH (LF): symmetric to ES — a task with no in-scope outgoing
//    edge is a graph SINK, anchored at its own actual end (there's nothing
//    downstream to constrain it, so its own deadline is the only one
//    there is). A task WITH outgoing edges gets its LF from the min, over
//    every outgoing edge, of the latest finish that still lets every
//    successor meet its own LS/LF.
//  - LATEST START (LS) = LF - duration.
//  - SLACK (total float) = LS - ES (equivalently LF - EF, since duration is
//    shared). A task is CRITICAL when slack <= EPSILON_DAYS (0, with a
//    floating-point guard only — every quantity involved is a whole number
//    of days, so a real critical link always lands on exactly 0, never a
//    fraction of a day). Slack can go negative for a schedule that's
//    already inconsistent with its own constraints (dates set by hand,
//    never pushed through the auto-reschedule cascade); a negative-slack
//    task is still treated as critical — it's already the tightest part of
//    the schedule, and arguably more so.
//  - A lone task (no incoming AND no outgoing in-scope edge) is
//    simultaneously its own root and sink, so ES = LS and EF = LF by
//    construction: it is trivially critical. There's no meaningful
//    "off-critical-path" state for a task with no dependency network to be
//    off the critical path OF.
//  - A "blocks" EDGE is critical when both its endpoints are critical AND
//    the edge is TIGHT: the specific earliest-start value that edge's
//    type + lag contributes, given the source's ES/EF, exactly equals the
//    target's ES (within EPSILON_DAYS). A diamond where one branch is
//    longer than the other has both branches contributing an edge into the
//    shared downstream task, but only the longer branch's edge is tight —
//    the shorter branch arrives with slack, so neither its tasks nor its
//    edge into the shared task are critical.

/** The four standard scheduling dependency types a "blocks" edge can carry. */
export type CriticalPathDependencyType = "fs" | "ss" | "ff" | "sf";

export type CriticalPathTaskInput = {
  id: string;
  scheduleStart: Date;
  scheduleEnd: Date;
};

export type CriticalPathEdgeInput = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  dependencyType: CriticalPathDependencyType;
  /** Lag (positive) or lead (negative), in whole days. */
  lagDays: number;
};

export type CriticalPathResult = {
  criticalTaskIds: ReadonlySet<string>;
  criticalEdgeIds: ReadonlySet<string>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Every quantity fed into this module (durations, lag) is a whole number of
// days, so a genuinely tight link always computes to exactly 0 slack — this
// only guards the comparisons below against stray floating-point error, not
// a real day of slack.
const EPSILON_DAYS = 1e-6;

function toDay(date: Date): number {
  return Math.round(date.getTime() / MS_PER_DAY);
}

// The earliest start this ONE edge forces onto its target, given the
// source's own (already-computed) ES/EF and the target's duration. Mirrors
// gantt-dependency-cascade.ts's edgeForcedDeltaDays, generalized to express
// an absolute day rather than a delta from the target's current schedule.
function forwardRequiredStart(
  type: CriticalPathDependencyType,
  lagDays: number,
  sourceES: number,
  sourceEF: number,
  targetDuration: number,
): number {
  switch (type) {
    case "ss":
      return sourceES + lagDays;
    case "ff":
      return sourceEF + lagDays - targetDuration;
    case "sf":
      return sourceES + lagDays - targetDuration;
    default:
      return sourceEF + lagDays;
  }
}

// The latest finish this ONE edge allows its source, given the target's own
// (already-computed) LS/LF and the source's duration — the backward-pass
// mirror of forwardRequiredStart above.
function backwardRequiredFinish(
  type: CriticalPathDependencyType,
  lagDays: number,
  targetLS: number,
  targetLF: number,
  sourceDuration: number,
): number {
  switch (type) {
    case "ss":
      return targetLS - lagDays + sourceDuration;
    case "ff":
      return targetLF - lagDays;
    case "sf":
      return targetLF - lagDays + sourceDuration;
    default:
      return targetLS - lagDays;
  }
}

export function computeCriticalPath(
  tasks: readonly CriticalPathTaskInput[],
  edges: readonly CriticalPathEdgeInput[],
): CriticalPathResult {
  const taskById = new Map(tasks.map((task) => [task.id, task] as const));
  const durationById = new Map<string, number>();
  for (const task of tasks) {
    durationById.set(
      task.id,
      toDay(task.scheduleEnd) - toDay(task.scheduleStart),
    );
  }

  // Only edges wholly inside the participating task set constrain the
  // network — an edge into a cross-project or dateless task has no
  // duration/anchor to reason about, so it's dropped here exactly like
  // gantt-dependency-cascade.ts drops out-of-scope edges. A self-edge can't
  // be expressed through the UI (cycle detection also rejects it), but it's
  // guarded here too rather than looping.
  const inScopeEdges = edges.filter(
    (edge) =>
      edge.sourceTaskId !== edge.targetTaskId &&
      taskById.has(edge.sourceTaskId) &&
      taskById.has(edge.targetTaskId),
  );

  const outgoingBySource = new Map<string, CriticalPathEdgeInput[]>();
  const incomingByTarget = new Map<string, CriticalPathEdgeInput[]>();
  for (const edge of inScopeEdges) {
    const outgoing = outgoingBySource.get(edge.sourceTaskId);
    if (outgoing) outgoing.push(edge);
    else outgoingBySource.set(edge.sourceTaskId, [edge]);

    const incoming = incomingByTarget.get(edge.targetTaskId);
    if (incoming) incoming.push(edge);
    else incomingByTarget.set(edge.targetTaskId, [edge]);
  }

  // Kahn's algorithm for a topological order over the in-scope subgraph —
  // the "blocks" graph is documented acyclic (creation rejects a cycle), so
  // this always visits every task; a task a cycle left unvisited (defensive
  // only, can't happen in practice) simply never gets an ES/EF/LS/LF below
  // and so is never marked critical.
  const remainingInDegree = new Map<string, number>();
  for (const task of tasks) remainingInDegree.set(task.id, 0);
  for (const edge of inScopeEdges) {
    remainingInDegree.set(
      edge.targetTaskId,
      (remainingInDegree.get(edge.targetTaskId) ?? 0) + 1,
    );
  }
  const queue: string[] = [];
  for (const [id, degree] of remainingInDegree)
    if (degree === 0) queue.push(id);
  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    topoOrder.push(current);
    for (const edge of outgoingBySource.get(current) ?? []) {
      const next = (remainingInDegree.get(edge.targetTaskId) ?? 0) - 1;
      remainingInDegree.set(edge.targetTaskId, next);
      if (next === 0) queue.push(edge.targetTaskId);
    }
  }

  // Forward pass: earliest start/finish, in topological order so every
  // source is finalized before a target that depends on it is computed.
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();
  for (const id of topoOrder) {
    const task = taskById.get(id);
    if (!task) continue;
    const duration = durationById.get(id) ?? 0;
    const incoming = incomingByTarget.get(id) ?? [];

    let start = toDay(task.scheduleStart);
    if (incoming.length > 0) {
      start = Number.NEGATIVE_INFINITY;
      for (const edge of incoming) {
        const sourceES = earliestStart.get(edge.sourceTaskId);
        const sourceEF = earliestFinish.get(edge.sourceTaskId);
        if (sourceES === undefined || sourceEF === undefined) continue;
        const required = forwardRequiredStart(
          edge.dependencyType,
          edge.lagDays,
          sourceES,
          sourceEF,
          duration,
        );
        if (required > start) start = required;
      }
      // Every incoming edge's source is in-scope (inScopeEdges guarantees
      // it) and processed earlier in topoOrder, so this is unreachable in
      // practice — guarded only so an unexpected gap never produces -Infinity.
      if (!Number.isFinite(start)) start = toDay(task.scheduleStart);
    }

    earliestStart.set(id, start);
    earliestFinish.set(id, start + duration);
  }

  // Backward pass: latest start/finish, walking topoOrder in reverse so
  // every target is finalized before a source that depends on it.
  const latestStart = new Map<string, number>();
  const latestFinish = new Map<string, number>();
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    const task = taskById.get(id);
    if (!task) continue;
    const duration = durationById.get(id) ?? 0;
    const outgoing = outgoingBySource.get(id) ?? [];

    let finish = toDay(task.scheduleEnd);
    if (outgoing.length > 0) {
      finish = Number.POSITIVE_INFINITY;
      for (const edge of outgoing) {
        const targetLS = latestStart.get(edge.targetTaskId);
        const targetLF = latestFinish.get(edge.targetTaskId);
        if (targetLS === undefined || targetLF === undefined) continue;
        const required = backwardRequiredFinish(
          edge.dependencyType,
          edge.lagDays,
          targetLS,
          targetLF,
          duration,
        );
        if (required < finish) finish = required;
      }
      if (!Number.isFinite(finish)) finish = toDay(task.scheduleEnd);
    }

    latestFinish.set(id, finish);
    latestStart.set(id, finish - duration);
  }

  const criticalTaskIds = new Set<string>();
  for (const task of tasks) {
    const es = earliestStart.get(task.id);
    const ls = latestStart.get(task.id);
    if (es === undefined || ls === undefined) continue;
    if (ls - es <= EPSILON_DAYS) criticalTaskIds.add(task.id);
  }

  const criticalEdgeIds = new Set<string>();
  for (const edge of inScopeEdges) {
    if (!criticalTaskIds.has(edge.sourceTaskId)) continue;
    if (!criticalTaskIds.has(edge.targetTaskId)) continue;
    const sourceES = earliestStart.get(edge.sourceTaskId);
    const sourceEF = earliestFinish.get(edge.sourceTaskId);
    const targetES = earliestStart.get(edge.targetTaskId);
    if (
      sourceES === undefined ||
      sourceEF === undefined ||
      targetES === undefined
    )
      continue;
    const targetDuration = durationById.get(edge.targetTaskId) ?? 0;
    const required = forwardRequiredStart(
      edge.dependencyType,
      edge.lagDays,
      sourceES,
      sourceEF,
      targetDuration,
    );
    if (Math.abs(targetES - required) <= EPSILON_DAYS) {
      criticalEdgeIds.add(edge.id);
    }
  }

  return { criticalTaskIds, criticalEdgeIds };
}
