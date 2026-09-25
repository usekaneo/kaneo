import { describe, expect, it } from "vitest";
import {
  buildDependencyEdges,
  buildElbowPoints,
  type DependencyEdgeInput,
  roundedPolylinePath,
  type TaskBarBox,
} from "./dependency-lines";

describe("buildElbowPoints", () => {
  it("draws a single straight hop when source and target share a row", () => {
    const source: TaskBarBox = { left: 0, right: 100, top: 0, height: 40 };
    const target: TaskBarBox = { left: 200, right: 300, top: 0, height: 40 };

    expect(buildElbowPoints(source, target)).toEqual([
      { x: 100, y: 20 },
      { x: 200, y: 20 },
    ]);
  });

  it("steps through the row gutter (out, across, in) when the target is clearly ahead", () => {
    const source: TaskBarBox = { left: 0, right: 100, top: 0, height: 40 };
    const target: TaskBarBox = { left: 200, right: 300, top: 80, height: 40 };

    const points = buildElbowPoints(source, target);

    expect(points[0]).toEqual({ x: 100, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 200, y: 100 });
    // The step's vertical run sits strictly between the two bars
    // horizontally (never at x=100 or x=200, where it would clip a bar
    // edge) and visits both rows' y levels along the way.
    const midX = points[1].x;
    expect(midX).toBeGreaterThan(100);
    expect(midX).toBeLessThan(200);
    expect(points.map((p) => p.y)).toEqual([20, 20, 100, 100]);
  });

  it("never routes the horizontal step through where a mid-height obstacle would sit — it stays clear of both bar x-ranges", () => {
    const source: TaskBarBox = { left: 0, right: 100, top: 0, height: 40 };
    const target: TaskBarBox = { left: 400, right: 500, top: 80, height: 40 };

    const [, { x: midX }] = buildElbowPoints(source, target);
    expect(midX).toBeGreaterThanOrEqual(114); // >= source.right + EXIT_GAP
    expect(midX).toBeLessThanOrEqual(386); // <= target.left - EXIT_GAP
  });

  it("loops around clear of both bars when the target sits behind the source", () => {
    const source: TaskBarBox = { left: 200, right: 260, top: 0, height: 40 };
    const target: TaskBarBox = { left: 0, right: 60, top: 80, height: 40 };

    const points = buildElbowPoints(source, target);

    expect(points[0]).toEqual({ x: 260, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 0, y: 100 });
    // The long horizontal run (the two middle points, once the path has
    // exited the source row and before it approaches the target row) clears
    // both bars' rows entirely — below the lower bar's bottom, since that's
    // the shorter detour here — rather than cutting back across either one
    // at bar height.
    expect(points[2].y).toBeGreaterThanOrEqual(134); // max(bottom) + EXIT_GAP
    expect(points[3].y).toBe(points[2].y);
  });

  it("loops around an overlapping pair (same-ish dates, small horizontal gap) instead of drawing a near-vertical cut through them", () => {
    // Mirrors the reported "overlapping pair": target starts before source
    // ends, so there's no room for a clean forward step.
    const source: TaskBarBox = { left: 40, right: 120, top: 0, height: 44 };
    const target: TaskBarBox = { left: 100, right: 180, top: 44, height: 44 };

    const points = buildElbowPoints(source, target);

    expect(points[0]).toEqual({ x: 120, y: 22 });
    expect(points[points.length - 1]).toEqual({ x: 100, y: 66 });
    expect(points.length).toBeGreaterThan(2);
  });
});

describe("roundedPolylinePath", () => {
  it("returns a plain two-point line as-is", () => {
    expect(
      roundedPolylinePath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        8,
      ),
    ).toBe("M 0 0 L 10 0");
  });

  it("rounds each interior corner of a multi-point path", () => {
    const path = roundedPolylinePath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      10,
    );
    expect(path).toBe(
      "M 0 0 L 90 0 Q 100 0, 100 10 L 100 90 Q 100 100, 110 100 L 200 100",
    );
  });

  it("clamps the radius so it never overruns a short segment", () => {
    const path = roundedPolylinePath(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 100 },
      ],
      10,
    );
    // radius is capped at half the 4px segment (2), not the requested 10.
    expect(path).toBe("M 0 0 L 2 0 Q 4 0, 4 2 L 4 100");
  });
});

describe("buildDependencyEdges", () => {
  it("connects a source bar's right edge to a target bar's left edge", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 0, right: 100, top: 0, height: 40 }],
      ["b", { left: 200, right: 300, top: 80, height: 40 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "e1",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "blocks",
      },
    ];

    const [edge] = buildDependencyEdges(edges, boxes);

    expect(edge.sourcePoint).toEqual({ x: 100, y: 20 });
    expect(edge.targetPoint).toEqual({ x: 200, y: 100 });
    expect(edge.path.startsWith("M 100 20")).toBe(true);
    expect(edge.path.endsWith("200 100")).toBe(true);
    expect(edge.relationType).toBe("blocks");
  });

  it("skips an edge whose source task box is missing (off-screen or filtered out)", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["b", { left: 200, right: 300, top: 0, height: 40 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "e1",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "related",
      },
    ];

    expect(buildDependencyEdges(edges, boxes)).toEqual([]);
  });

  it("skips an edge whose target task box is missing", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 0, right: 100, top: 0, height: 40 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "e1",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "related",
      },
    ];

    expect(buildDependencyEdges(edges, boxes)).toEqual([]);
  });

  it("still produces a routable path when the target sits before the source", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 200, right: 260, top: 0, height: 40 }],
      ["b", { left: 0, right: 60, top: 80, height: 40 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "e1",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "blocks",
      },
    ];

    const [edge] = buildDependencyEdges(edges, boxes);

    expect(edge.sourcePoint.x).toBe(260);
    expect(edge.targetPoint.x).toBe(0);
    expect(edge.path).toMatch(/^M 260 20/);
  });

  // Proves the full data-shape used by the Gantt route: two same-project
  // tasks with overlapping dates, a "blocks" relation between them, and
  // measured boxes for both — exactly the case reported as "no line drawn".
  // If the boxes are present, buildDependencyEdges must always produce
  // exactly one red (blocking) edge; a regression here would mean the
  // geometry step itself is the reason nothing renders.
  it("draws exactly one blocking edge for two same-project tasks with overlapping dates once both are measured", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["task-a", { left: 40, right: 120, top: 0, height: 44 }],
      ["task-b", { left: 100, right: 180, top: 44, height: 44 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "relation-1",
        sourceTaskId: "task-a",
        targetTaskId: "task-b",
        relationType: "blocks",
      },
    ];

    const geometry = buildDependencyEdges(edges, boxes);

    expect(geometry).toHaveLength(1);
    expect(geometry[0].relationType).toBe("blocks");
    expect(geometry[0].sourcePoint).toEqual({ x: 120, y: 22 });
    expect(geometry[0].targetPoint).toEqual({ x: 100, y: 66 });
  });

  it("preserves relation type and id on the built edge", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 0, right: 100, top: 0, height: 40 }],
      ["b", { left: 200, right: 300, top: 0, height: 40 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "rel-42",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "related",
      },
    ];

    const [edge] = buildDependencyEdges(edges, boxes);
    expect(edge.id).toBe("rel-42");
    expect(edge.relationType).toBe("related");
  });

  it("never routes to the left of the leftmost bar by more than the small exit gap, so the connector cannot bleed toward the task rail", () => {
    const source: TaskBarBox = { left: 500, right: 560, top: 0, height: 40 };
    const target: TaskBarBox = { left: 480, right: 540, top: 40, height: 40 };

    const points = buildElbowPoints(source, target);
    const minX = Math.min(...points.map((p) => p.x));
    expect(minX).toBeGreaterThanOrEqual(480 - 14 - 1);
  });
});
