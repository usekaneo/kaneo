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

// The polyline a dependency connector travels, routed so it runs through the
// gaps around bars rather than diagonally across them:
//  - same row: a single straight hop, source edge to target edge.
//  - target clearly to the right: leave the source's end edge, run one
//    horizontal-then-vertical-then-horizontal "step" through the inter-row
//    gutter at the midpoint, and arrive at the target's start edge.
//  - target behind the source (a backward-scheduled edge) or too close to
//    fit a clean step: leave the source to the right, drop into a
//    horizontal lane that clears both bars entirely (above whichever box is
//    higher, or below whichever is lower — whichever is the shorter detour),
//    travel the length of that lane, then approach the target's start edge
//    from the left, the same direction every other edge arrives from.
export function buildElbowPoints(
  source: TaskBarBox,
  target: TaskBarBox,
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
    const midX = clamp(
      sourceX + gap / 2,
      sourceX + EXIT_GAP,
      targetX - EXIT_GAP,
    );
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

  for (const edge of edges) {
    const source = taskBoxes.get(edge.sourceTaskId);
    const target = taskBoxes.get(edge.targetTaskId);
    if (!source || !target) continue;

    const points = buildElbowPoints(source, target);
    const path = roundedPolylinePath(points, CORNER_RADIUS);
    const sourcePoint = points[0];
    const targetPoint = points[points.length - 1];

    geometry.push({ ...edge, path, sourcePoint, targetPoint });
  }

  return geometry;
}
