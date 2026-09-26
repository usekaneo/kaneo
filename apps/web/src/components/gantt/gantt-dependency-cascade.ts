// Pure "forward-push" cascade math for the Gantt's dependency auto-reschedule
// feature. Kept free of React, the DOM, and the network — like the rest of
// this folder's pure modules (dependency-lines.ts, gantt-hierarchy.ts, ...) —
// so the scheduling logic is unit-testable directly, and the Gantt route only
// has to turn its result into a single bulk-update call.
//
// MODEL (deliberately the simplest one that makes correct behavior obvious —
// see AGENTS.md):
//  - FORWARD-ONLY: a dependent only ever moves LATER to satisfy a violated
//    constraint. Moving a predecessor EARLIER never pulls a dependent back;
//    an already-satisfied constraint (source moved earlier, or a dependent
//    already comfortably later than required) yields a computed delta of
//    zero, never negative.
//  - DURATION-PRESERVING: a shifted task's start and due date move by the
//    exact same number of days, so its span length never changes.
//  - Only a "blocks" edge constrains scheduling (see dependencyType below);
//    callers must filter out "related"/"subtask" edges before calling this.
//  - SCOPE: only tasks present in `tasksById` can be shifted or used as a
//    constraint source. A "blocks" edge into a task that isn't there — most
//    commonly a cross-project dependent, which has no row on this project's
//    own Gantt, or an own task with no start/due date at all — has nothing to
//    shift, so it (and anything only reachable through it) is silently left
//    out of the result, the same "no box, no data" rule the rest of the
//    Gantt already applies to those tasks. Callers should therefore build
//    `tasksById` from only this project's own scheduled tasks.
//  - WORKING-CALENDAR NUDGE (opt-in via the `isWorkingDay` predicate): once a
//    constraint has pushed a task's start onto a non-working day (weekend or
//    workspace holiday), it's nudged FORWARD to the next working day, with
//    its end carried along by the same number of days — duration-preserving
//    like every other shift here. The moved task itself is never nudged
//    (see above). Downstream tasks see this nudged schedule, so a nudge can
//    itself force a further shift on anything blocked by it.
//  - PINNED TASKS (opt-in via the `pinnedTaskIds` set — Phase 3c-ii task date
//    constraints): a task with a `must_start_on` constraint is IMMOVABLE —
//    this cascade never shifts it, no matter what forced delta an incoming
//    edge would otherwise compute. Its dependents cascade from its ACTUAL
//    (pinned) schedule, exactly as if it had never been pushed at all: the
//    delta that would have shifted it is discarded, not propagated further,
//    so a phantom "would-be" shift can never leak through a pinned task to
//    its own dependents. `start_no_earlier_than`/`finish_no_later_than`
//    constraints are NOT pinning and don't affect cascade movement at all —
//    a forward-only push already respects a start floor, and a finish
//    deadline is a violation the Gantt surfaces separately (see
//    gantt-constraint-violations.ts), not something this cascade enforces by
//    moving the task. Omitted (the default): no pinned tasks, exactly
//    today's behavior.

/** The four standard scheduling dependency types a "blocks" edge can carry. */
export type CascadeDependencyType = "fs" | "ss" | "ff" | "sf";

export type CascadeEdge = {
  sourceTaskId: string;
  targetTaskId: string;
  dependencyType: CascadeDependencyType;
  /** Lag (positive) or lead (negative) in whole days. */
  lagDays: number;
};

export type CascadeSchedule = {
  start: Date;
  end: Date;
};

export type ComputeDependencyCascadeInput = {
  /** The task whose drag/resize just committed. Its entry in `tasksById`
   * must already reflect its NEW (post-commit) schedule — this function
   * treats it as fixed and never adjusts it. */
  movedTaskId: string;
  /** "blocks" edges only (any relation type this project's Gantt tracks that
   * isn't "blocks" — e.g. "related" — must be filtered out by the caller). */
  edges: readonly CascadeEdge[];
  /** Every in-scope task's current schedule, keyed by task id — this
   * project's own tasks with known dates, with `movedTaskId` already
   * overridden to its new schedule (see above). A task absent from this map
   * is out of scope: it can neither be shifted nor gate anything downstream
   * of it. */
  tasksById: ReadonlyMap<string, CascadeSchedule>;
  /** Workspace working-calendar predicate (see gantt-working-calendar.ts):
   * true when `d` is a working day (not a weekend per the workspace's
   * bitmask, and not a holiday). When a "blocks" constraint pushes a task's
   * start onto a non-working day, that task is nudged FORWARD to the next
   * working day, with its end moving by the same total delta so its span
   * length is preserved (see finalizeNode below). `movedTaskId` itself is
   * NEVER nudged — only tasks this cascade actually shifts. Omitted (the
   * default): no nudging, exactly today's behavior. */
  isWorkingDay?: (d: Date) => boolean;
  /** Task ids pinned by a `must_start_on` constraint (see the PINNED TASKS
   * note above) — immovable by this cascade, and never a conduit for a
   * phantom shift onto their own dependents. Omitted (the default): no
   * pinned tasks, exactly today's behavior. */
  pinnedTaskIds?: ReadonlySet<string>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole-day difference, matching the day-granular arithmetic the rest of the
// Gantt's drag/resize code uses (see gantt-task-bar.tsx's addDays/
// differenceInCalendarDays). The two instants are the same task-schedule
// dates the caller already works in, and `Math.round` absorbs any intra-day
// offset between them, so a plain millisecond division yields the exact
// whole-day delta without needing date-fns' calendar-aware version.
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

function addDaysExact(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// The minimum day-delta this ONE edge forces onto the target, expressed as
// "how far forward the target's whole span must move" — always relative to
// the target's CURRENT (not yet shifted-by-this-edge) schedule, so multiple
// incoming edges can be combined by taking their max (see finalizeNode
// below).
function edgeForcedDeltaDays(
  edge: CascadeEdge,
  source: CascadeSchedule,
  target: CascadeSchedule,
): number {
  switch (edge.dependencyType) {
    case "fs":
      return diffDays(addDaysExact(source.end, edge.lagDays), target.start);
    case "ss":
      return diffDays(addDaysExact(source.start, edge.lagDays), target.start);
    case "ff":
      return diffDays(addDaysExact(source.end, edge.lagDays), target.end);
    case "sf":
      return diffDays(addDaysExact(source.start, edge.lagDays), target.end);
    default:
      return 0;
  }
}

/**
 * Given a task's just-committed move/resize, computes every OTHER task that
 * must shift later to keep every "blocks" constraint reachable from it
 * satisfied — transitively, in one pass, in topological order over the
 * (guaranteed acyclic) "blocks" graph.
 *
 * Returns a map of taskId -> new {start, end} for exactly the dependents that
 * actually need to move (an edge that isn't violated contributes nothing).
 * `movedTaskId` itself is never in the result — its own new schedule was
 * already supplied by the caller in `tasksById` and is persisted separately.
 */
export function computeDependencyCascade({
  movedTaskId,
  edges,
  tasksById,
  isWorkingDay,
  pinnedTaskIds,
}: ComputeDependencyCascadeInput): Map<string, CascadeSchedule> {
  const shifts = new Map<string, CascadeSchedule>();
  if (!tasksById.has(movedTaskId)) return shifts;

  const outgoingBySource = new Map<string, CascadeEdge[]>();
  const incomingByTarget = new Map<string, CascadeEdge[]>();
  for (const edge of edges) {
    // A self-referencing edge can't be expressed through the UI (cycle
    // detection also rejects it), but guard it anyway rather than looping.
    if (edge.sourceTaskId === edge.targetTaskId) continue;
    if (!tasksById.has(edge.sourceTaskId) || !tasksById.has(edge.targetTaskId))
      continue;

    const outgoing = outgoingBySource.get(edge.sourceTaskId);
    if (outgoing) outgoing.push(edge);
    else outgoingBySource.set(edge.sourceTaskId, [edge]);

    const incoming = incomingByTarget.get(edge.targetTaskId);
    if (incoming) incoming.push(edge);
    else incomingByTarget.set(edge.targetTaskId, [edge]);
  }

  // Every task transitively downstream of the moved one, through in-scope
  // "blocks" edges only. Forward-only push means nothing outside this set
  // can possibly need to move.
  const reachable = new Set<string>();
  const bfsQueue = [movedTaskId];
  while (bfsQueue.length > 0) {
    const current = bfsQueue.shift();
    if (current === undefined) break;
    for (const edge of outgoingBySource.get(current) ?? []) {
      if (edge.targetTaskId === movedTaskId) continue;
      if (reachable.has(edge.targetTaskId)) continue;
      reachable.add(edge.targetTaskId);
      bfsQueue.push(edge.targetTaskId);
    }
  }
  if (reachable.size === 0) return shifts;

  const subgraph = new Set([movedTaskId, ...reachable]);

  // Kahn's algorithm, restricted to the subgraph: a node's in-degree only
  // counts predecessors ALSO in the subgraph. A predecessor outside it (some
  // other, unmoved task that also blocks this one) keeps its original
  // schedule throughout, so its constraint was already satisfied before this
  // cascade started and stays satisfied once this node only ever moves
  // later — it never needs to gate finalization.
  const inDegree = new Map<string, number>();
  for (const id of subgraph) inDegree.set(id, 0);
  for (const id of subgraph) {
    for (const edge of outgoingBySource.get(id) ?? []) {
      if (!subgraph.has(edge.targetTaskId)) continue;
      inDegree.set(
        edge.targetTaskId,
        (inDegree.get(edge.targetTaskId) ?? 0) + 1,
      );
    }
  }

  // Each subgraph task's schedule once finalized — starts as every task's
  // original schedule, then overwritten in topological order as nodes are
  // processed (a node is only finalized after every in-subgraph predecessor
  // is), so a downstream constraint check always reads its source's FINAL
  // (possibly already-shifted) schedule, never a stale one.
  const finalSchedule = new Map<string, CascadeSchedule>();
  for (const id of subgraph) {
    const schedule = tasksById.get(id);
    if (schedule) finalSchedule.set(id, schedule);
  }

  function finalizeNode(taskId: string) {
    const original = tasksById.get(taskId);
    if (!original) return; // Guarded by the subgraph construction above.

    // Pinned (must_start_on): never shift it, and never propagate the delta
    // that would have — finalSchedule keeps its real schedule, so any
    // dependent's forced delta is computed against that real schedule, not a
    // hypothetical shifted one. Deliberately returns before touching `shifts`
    // (the map of what actually moved), so a pinned task is reported as
    // unmoved even though it may have "wanted" to shift.
    if (pinnedTaskIds?.has(taskId)) {
      finalSchedule.set(taskId, original);
      return;
    }

    let deltaDays = 0;
    for (const edge of incomingByTarget.get(taskId) ?? []) {
      if (!subgraph.has(edge.sourceTaskId)) continue;
      const source = finalSchedule.get(edge.sourceTaskId);
      if (!source) continue;
      const forced = edgeForcedDeltaDays(edge, source, original);
      if (forced > deltaDays) deltaDays = forced;
    }

    if (deltaDays <= 0) {
      finalSchedule.set(taskId, original);
      return;
    }

    let shiftedStart = addDaysExact(original.start, deltaDays);
    let shiftedEnd = addDaysExact(original.end, deltaDays);

    // Working-calendar nudge: a constraint can only push a task LATER, never
    // land it exactly on a day nobody works — so if the forced start falls
    // on a non-working day, walk forward to the next working one and carry
    // the end along by the same number of extra days (duration-preserving,
    // same as the constraint shift itself). Capped well beyond a year of
    // consecutive non-working days as a defensive bound; a real calendar
    // (weekends + a finite holiday list) always has a working day within a
    // week.
    if (isWorkingDay) {
      let nudgeDays = 0;
      while (
        nudgeDays < 366 &&
        !isWorkingDay(addDaysExact(shiftedStart, nudgeDays))
      ) {
        nudgeDays++;
      }
      if (nudgeDays > 0) {
        shiftedStart = addDaysExact(shiftedStart, nudgeDays);
        shiftedEnd = addDaysExact(shiftedEnd, nudgeDays);
      }
    }

    const shifted: CascadeSchedule = { start: shiftedStart, end: shiftedEnd };
    finalSchedule.set(taskId, shifted);
    shifts.set(taskId, shifted);
  }

  const ready: string[] = [movedTaskId];
  const remainingInDegree = new Map(inDegree);
  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) break;
    for (const edge of outgoingBySource.get(current) ?? []) {
      if (!subgraph.has(edge.targetTaskId)) continue;
      const remaining = (remainingInDegree.get(edge.targetTaskId) ?? 0) - 1;
      remainingInDegree.set(edge.targetTaskId, remaining);
      if (remaining === 0) {
        finalizeNode(edge.targetTaskId);
        ready.push(edge.targetTaskId);
      }
    }
  }
  // Any subgraph node whose in-degree never reached zero sits on a cycle,
  // which "blocks" creation already rejects — left unfinalized/un-shifted
  // rather than guessed at, as a defensive fallback that can't happen in
  // practice.

  return shifts;
}
