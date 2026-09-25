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

const MIN_CURVE_OFFSET = 24;
const MAX_CURVE_OFFSET = 120;

function curveOffset(dx: number) {
  return Math.min(
    Math.max(Math.abs(dx) / 2, MIN_CURVE_OFFSET),
    MAX_CURVE_OFFSET,
  );
}

function verticalCenter(box: TaskBarBox) {
  return box.top + box.height / 2;
}

// A finish-to-start connector from the source bar's right edge to the
// target bar's left edge. The horizontal control-point offset grows with
// the distance between the bars (up to a cap) so short hops stay tight and
// long ones still read as one smooth curve; it works the same way when the
// target sits to the left of the source (a backward-scheduled dependency),
// producing a wide loop instead of a degenerate line.
export function buildDependencyEdges(
  edges: DependencyEdgeInput[],
  taskBoxes: ReadonlyMap<string, TaskBarBox>,
): DependencyEdgeGeometry[] {
  const geometry: DependencyEdgeGeometry[] = [];

  for (const edge of edges) {
    const source = taskBoxes.get(edge.sourceTaskId);
    const target = taskBoxes.get(edge.targetTaskId);
    if (!source || !target) continue;

    const sourcePoint = { x: source.right, y: verticalCenter(source) };
    const targetPoint = { x: target.left, y: verticalCenter(target) };
    const offset = curveOffset(targetPoint.x - sourcePoint.x);

    const path = `M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x + offset} ${sourcePoint.y}, ${targetPoint.x - offset} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`;

    geometry.push({ ...edge, path, sourcePoint, targetPoint });
  }

  return geometry;
}
