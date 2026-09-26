import type { DependencyEdgeGeometry } from "./dependency-lines";
import type { Point } from "./gantt-link-drag";

type GanttDependencyOverlayProps = {
  edges: DependencyEdgeGeometry[];
  hoveredTaskId: string | null;
  /** Edge ids on the currently-highlighted critical path (see
   * gantt-critical-path.ts). Undefined/empty draws every line exactly as
   * before — this is purely additive. */
  criticalEdgeIds?: ReadonlySet<string>;
  /** Pixels from the overlay's left edge to where the timeline (day) columns
   * start — a backward-scheduled edge's curve can bow further left than its
   * target point, and this clips it so it never bleeds into the sticky task
   * rail beside it. */
  clipLeftPx: number;
  /** The in-progress "drag to create a dependency" gesture (see
   * handleLinkDragStart in gantt.tsx): a straight line from the source bar's
   * finish edge to the current pointer position, drawn while the gesture is
   * live and gone once it ends (dropped, cancelled, or completed — the real
   * edge then appears via the usual relations refetch). */
  preview?: { source: Point; pointer: Point } | null;
};

// Resting/emphasized/dimmed visual states for the connector lines. Hovering
// a task bar (driven from gantt.tsx via `hoveredTaskId`) brings its own
// edges to full strength and fades every other edge down, rather than
// toggling a binary highlighted/not state, so the chart still reads as one
// picture instead of flashing between two very different views.
const REST_OPACITY = 0.55;
const DIMMED_OPACITY = 0.12;
const REST_WIDTH = 1.5;
const EMPHASIZED_WIDTH = 2.5;

export function GanttDependencyOverlay({
  edges,
  hoveredTaskId,
  criticalEdgeIds,
  clipLeftPx,
  preview = null,
}: GanttDependencyOverlayProps) {
  if (edges.length === 0 && !preview) return null;

  return (
    <svg
      aria-hidden="true"
      // Below the per-row sticky task rail (z-[11] in the gantt route) so a
      // curve that scrolls under the pinned rail is occluded by it rather
      // than painting on top — that relationship holds at any scrollLeft,
      // unlike the clip-path below (which is expressed in the overlay's own,
      // scrolling coordinate space and only lines up with the rail pre-scroll).
      // Still above the day-grid background and the task bars themselves.
      className="pointer-events-none absolute inset-0 z-[9] h-full w-full overflow-visible"
      // Only the left edge is meant to protect the sticky task rail; top and
      // bottom stay wide open (a large negative inset, rather than 0) so a
      // backward or looping connector that routes above the first row or
      // below the last row (see buildElbowPoints's "above"/"below" lanes)
      // still renders in full instead of being cut off at the overlay's own
      // vertical bounds.
      style={{
        clipPath: `inset(-2000px 0 -2000px ${Math.max(clipLeftPx, 0)}px)`,
      }}
    >
      <defs>
        <marker
          id="gantt-dependency-arrow-blocks"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="6.5"
          markerHeight="6.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--destructive)" />
        </marker>
        <marker
          id="gantt-dependency-arrow-related"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="6.5"
          markerHeight="6.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const isBlocking = edge.relationType === "blocks";
        const isIncident =
          hoveredTaskId !== null &&
          (edge.sourceTaskId === hoveredTaskId ||
            edge.targetTaskId === hoveredTaskId);
        const isDimmed = hoveredTaskId !== null && !isIncident;
        const isCritical = criticalEdgeIds?.has(edge.id) ?? false;
        const strokeWidth = isIncident ? EMPHASIZED_WIDTH : REST_WIDTH;

        return (
          <g key={edge.id}>
            {/* Critical-path accent: a wider amber halo drawn BEHIND the
                edge's own (red/gray) line, rather than recoloring it —
                blocking lines are already red, so a plain color swap would
                be indistinguishable from "blocking", and this reads
                correctly regardless of hue perception since it differs in
                shape (a visible halo), not only in color. */}
            {isCritical && (
              <path
                d={edge.path}
                fill="none"
                stroke="var(--warning)"
                strokeWidth={strokeWidth + 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={isDimmed ? DIMMED_OPACITY : 0.85}
                className="transition-[stroke-opacity] duration-150 ease-out"
              />
            )}
            <path
              d={edge.path}
              fill="none"
              stroke={
                isBlocking ? "var(--destructive)" : "var(--muted-foreground)"
              }
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={
                isDimmed ? DIMMED_OPACITY : isIncident ? 1 : REST_OPACITY
              }
              markerEnd={`url(#gantt-dependency-arrow-${isBlocking ? "blocks" : "related"})`}
              className="transition-[stroke-opacity,stroke-width] duration-150 ease-out"
            />
            {edge.lagLabelPoint && edge.lagDays !== undefined && (
              <text
                x={edge.lagLabelPoint.x}
                y={edge.lagLabelPoint.y - 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill="var(--destructive)"
                fillOpacity={isDimmed ? DIMMED_OPACITY : 1}
                className="select-none transition-[fill-opacity] duration-150 ease-out"
              >
                {edge.lagDays > 0 ? `+${edge.lagDays}d` : `${edge.lagDays}d`}
              </text>
            )}
          </g>
        );
      })}
      {preview && (
        <path
          data-testid="gantt-link-preview"
          d={`M ${preview.source.x} ${preview.source.y} L ${preview.pointer.x} ${preview.pointer.y}`}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
