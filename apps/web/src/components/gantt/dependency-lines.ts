// Pure geometry for the Gantt dependency-line overlay. Kept free of the DOM
// and of React so the curve math is unit-testable without rendering
// anything: callers measure pixel boxes for each visible task bar, and this
// module turns relation edges into SVG path data between them.

export type GanttDependencyRelationType = "blocks" | "related";

export type DependencyEdgeInput = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: GanttDependencyRelationType;
};

export type TaskBarBox = {
  /** Pixels from the overlay's left edge to the bar's start (left) edge. */
  left: number;
  /** Pixels from the overlay's left edge to the bar's end (right) edge. */
  right: number;
  /** Pixels from the overlay's top edge to the row's top edge. */
  top: number;
  /** The row's rendered height in pixels. */
  height: number;
};

export type DependencyEdgeGeometry = DependencyEdgeInput & {
  path: string;
  sourcePoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
};

type Point = { x: number; y: number };

// How far a connector travels out of a bar's edge (into the row's own
// horizontal gutter — the empty space in that row before/after the bar)
// before it's allowed to turn. Keeping this small but non-zero is what makes
// the line visibly "leave" the bar rather than touching a corner exactly at
// its edge.
const EXIT_GAP = 14;
// Corner rounding radius for the elbow's turns.
const CORNER_RADIUS = 8;

function verticalCenter(box: TaskBarBox) {
  return box.top + box.height / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// A small margin added around an obstacle's x-range in pickClearMidX so the
// step's vertical run visibly clears the bar rather than grazing its edge.
const OBSTACLE_CLEARANCE = 4;

// Chooses the vertical run's x position for the "clear forward step" case
// below. Defaults to the midpoint of the gap, same as before, but steps
// aside when an intermediate task's bar — one that sits in a row between the
// source and target rows, not the source or target themselves — would
// otherwise have the line cut straight through it. This only avoids bars
// whose row lies between the two endpoints; it isn't full graph
// obstacle-avoidance, so a sufficiently cluttered chart can still fall back
// to the default midpoint (see the `best ?? defaultMid` below).
function pickClearMidX(
  sourceX: number,
  targetX: number,
  obstacles: readonly TaskBarBox[],
): number {
  const rangeMin = sourceX + EXIT_GAP;
  const rangeMax = targetX - EXIT_GAP;
  const defaultMid = clamp(
    sourceX + (targetX - sourceX) / 2,
    rangeMin,
    rangeMax,
  );
  if (obstacles.length === 0) return defaultMid;

  const blocked = obstacles
    .map(
      (box) =>
        [box.left - OBSTACLE_CLEARANCE, box.right + OBSTACLE_CLEARANCE] as [
          number,
          number,
        ],
    )
    .filter(([left, right]) => right > rangeMin && left < rangeMax)
    .sort((a, b) => a[0] - b[0]);

  const isBlocked = (x: number) =>
    blocked.some(([left, right]) => x > left && x < right);
  if (!isBlocked(defaultMid)) return defaultMid;

  // Merge overlapping/adjacent blocked intervals, then read off the open
  // gaps between them (clipped to the routable [rangeMin, rangeMax] span).
  const merged: [number, number][] = [];
  for (const [left, right] of blocked) {
    const last = merged[merged.length - 1];
    if (last && left <= last[1]) {
      last[1] = Math.max(last[1], right);
    } else {
      merged.push([left, right]);
    }
  }

  const gaps: [number, number][] = [];
  let cursor = rangeMin;
  for (const [left, right] of merged) {
    if (left > cursor) gaps.push([cursor, Math.min(left, rangeMax)]);
    cursor = Math.max(cursor, right);
  }
  if (cursor < rangeMax) gaps.push([cursor, rangeMax]);

  // Whichever open gap's closest point sits nearest the default midpoint —
  // keeps the elbow as close to a straight, centered step as the obstacles
  // allow, rather than always preferring the leftmost or rightmost gap.
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [left, right] of gaps) {
    if (right <= left) continue;
    const candidate = clamp(defaultMid, left, right);
    const distance = Math.abs(candidate - defaultMid);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best ?? defaultMid;
}

// The polyline a dependency connector travels, routed so it runs through the
// gaps around bars rather than diagonally across them:
//  - same row: a single straight hop, source edge to target edge.
//  - target clearly to the right: leave the source's end edge, run one
//    horizontal-then-vertical-then-horizontal "step" through the inter-row
//    gutter, and arrive at the target's start edge. The vertical run sits at
//    the gap's midpoint unless an intermediate task's bar occupies it, in
//    which case it steps aside to the nearest clear gap (pickClearMidX).
//  - target behind the source (a backward-scheduled edge) or too close to
//    fit a clean step: leave the source to the right, drop into a
//    horizontal lane that clears both bars entirely (above whichever box is
//    higher, or below whichever is lower — whichever is the shorter detour),
//    travel the length of that lane, then approach the target's start edge
//    from the left, the same direction every other edge arrives from.
export function buildElbowPoints(
  source: TaskBarBox,
  target: TaskBarBox,
  obstacles: readonly TaskBarBox[] = [],
): Point[] {
  const sourceX = source.right;
  const sourceY = verticalCenter(source);
  const targetX = target.left;
  const targetY = verticalCenter(target);

  if (Math.abs(sourceY - targetY) < 0.5) {
    return [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ];
  }

  const gap = targetX - sourceX;
  if (gap >= EXIT_GAP * 2) {
    const minY = Math.min(sourceY, targetY);
    const maxY = Math.max(sourceY, targetY);
    // Only bars whose row actually lies within the vertical run the elbow
    // travels through can be crossed by it — source/target themselves are
    // excluded here (rather than by the caller pre-filtering the whole
    // shared obstacle set per edge, an O(edges x boxes) allocation on every
    // call) since this same pass already has to walk every box to check its
    // row.
    const intermediateObstacles = obstacles.filter(
      (box) =>
        box !== source &&
        box !== target &&
        box.top < maxY &&
        box.top + box.height > minY,
    );
    const midX = pickClearMidX(sourceX, targetX, intermediateObstacles);
    return [
      { x: sourceX, y: sourceY },
      { x: midX, y: sourceY },
      { x: midX, y: targetY },
      { x: targetX, y: targetY },
    ];
  }

  // Not enough horizontal room for a clean step (including the backward
  // case, where the target sits at or before the source): go around instead
  // of through. `below`/`above` are lanes that clear BOTH boxes entirely —
  // below the lower of the two bottoms, or above the higher of the two tops
  // — so the long horizontal run never crosses either bar.
  const exitX = sourceX + EXIT_GAP;
  const approachX = targetX - EXIT_GAP;
  const below =
    Math.max(source.top + source.height, target.top + target.height) + EXIT_GAP;
  const above = Math.min(source.top, target.top) - EXIT_GAP;
  const belowTravel = Math.abs(below - sourceY) + Math.abs(below - targetY);
  const aboveTravel = Math.abs(above - sourceY) + Math.abs(above - targetY);
  const laneY = belowTravel <= aboveTravel ? below : above;

  return [
    { x: sourceX, y: sourceY },
    { x: exitX, y: sourceY },
    { x: exitX, y: laneY },
    { x: approachX, y: laneY },
    { x: approachX, y: targetY },
    { x: targetX, y: targetY },
  ];
}

// Turns a polyline into an SVG path with each interior corner rounded to
// `radius` (clamped so it never overruns a segment shorter than the radius
// itself). A straight 2-point line needs no rounding and is returned as a
// plain `M ... L ...`.
export function roundedPolylinePath(points: Point[], radius: number): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLen = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const inRatio = inLen === 0 ? 0 : r / inLen;
    const outRatio = outLen === 0 ? 0 : r / outLen;
    const before = {
      x: corner.x - (corner.x - prev.x) * inRatio,
      y: corner.y - (corner.y - prev.y) * inRatio,
    };
    const after = {
      x: corner.x + (next.x - corner.x) * outRatio,
      y: corner.y + (next.y - corner.y) * outRatio,
    };
    d += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y}, ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

// A finish-to-start connector from the source bar's right edge to the
// target bar's left edge, routed as a rounded elbow through the gaps around
// bars (see buildElbowPoints) rather than a straight diagonal across them.
export function buildDependencyEdges(
  edges: DependencyEdgeInput[],
  taskBoxes: ReadonlyMap<string, TaskBarBox>,
): DependencyEdgeGeometry[] {
  const geometry: DependencyEdgeGeometry[] = [];
  // Built once and passed to every edge's buildElbowPoints call as-is: every
  // other visible bar is a potential intermediate obstacle for a given edge,
  // and buildElbowPoints itself narrows this down (and excludes that edge's
  // own source/target) to the ones whose row actually sits between its two
  // endpoints. Re-filtering this whole array per edge (to drop that edge's
  // source/target first) would allocate an O(edges x boxes) amount of
  // throwaway arrays on a chart with many dependency lines, re-run on every
  // zoom notch — sharing the one array instead keeps this O(boxes) overall.
  const allBoxes = [...taskBoxes.values()];

  for (const edge of edges) {
    const source = taskBoxes.get(edge.sourceTaskId);
    const target = taskBoxes.get(edge.targetTaskId);
    if (!source || !target) continue;

    const points = buildElbowPoints(source, target, allBoxes);
    const path = roundedPolylinePath(points, CORNER_RADIUS);
    const sourcePoint = points[0];
    const targetPoint = points[points.length - 1];

    geometry.push({ ...edge, path, sourcePoint, targetPoint });
  }

  return geometry;
}
