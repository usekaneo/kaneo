import type { DependencyEdgeGeometry } from "./dependency-lines";

type GanttDependencyOverlayProps = {
  edges: DependencyEdgeGeometry[];
  hoveredTaskId: string | null;
  /** Pixels from the overlay's left edge to where the timeline (day) columns
   * start — a backward-scheduled edge's curve can bow further left than its
   * target point, and this clips it so it never bleeds into the sticky task
   * rail beside it. */
  clipLeftPx: number;
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
  clipLeftPx,
}: GanttDependencyOverlayProps) {
  if (edges.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
      style={{ clipPath: `inset(0 0 0 ${Math.max(clipLeftPx, 0)}px)` }}
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

        return (
          <path
            key={edge.id}
            d={edge.path}
            fill="none"
            stroke={
              isBlocking ? "var(--destructive)" : "var(--muted-foreground)"
            }
            strokeWidth={isIncident ? EMPHASIZED_WIDTH : REST_WIDTH}
            strokeOpacity={
              isDimmed ? DIMMED_OPACITY : isIncident ? 1 : REST_OPACITY
            }
            markerEnd={`url(#gantt-dependency-arrow-${isBlocking ? "blocks" : "related"})`}
            className="transition-[stroke-opacity,stroke-width] duration-150 ease-out"
          />
        );
      })}
    </svg>
  );
}
