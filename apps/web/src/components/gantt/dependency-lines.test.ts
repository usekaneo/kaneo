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

  it("steps aside to clear an intermediate task's bar sitting between the two endpoints, instead of cutting straight through it", () => {
    const source: TaskBarBox = { left: 0, right: 100, top: 0, height: 40 };
    const target: TaskBarBox = { left: 400, right: 500, top: 80, height: 40 };
    // Sits in the row between source and target, spanning the default
    // midpoint (250) the un-obstructed case would otherwise pick.
    const intermediate: TaskBarBox = {
      left: 200,
      right: 300,
      top: 40,
      height: 40,
    };

    const [, { x: midXWithObstacle }] = buildElbowPoints(source, target, [
      intermediate,
    ]);
    const [, { x: midXWithoutObstacle }] = buildElbowPoints(source, target);

    // Without the obstacle the default midpoint (250) sits inside it.
    expect(midXWithoutObstacle).toBeGreaterThan(200);
    expect(midXWithoutObstacle).toBeLessThan(300);
    // With it, the vertical run steps clear of the intermediate bar's
    // x-range entirely (plus its small clearance margin).
    expect(midXWithObstacle <= 196 || midXWithObstacle >= 304).toBe(true);
    // Still a valid, routable position between the two endpoints.
    expect(midXWithObstacle).toBeGreaterThanOrEqual(114);
    expect(midXWithObstacle).toBeLessThanOrEqual(386);
  });

  it("ignores an obstacle whose row doesn't fall between the two endpoints", () => {
    const source: TaskBarBox = { left: 0, right: 100, top: 0, height: 40 };
    const target: TaskBarBox = { left: 400, right: 500, top: 80, height: 40 };
    // Below the target's row entirely — outside [sourceY, targetY], so it
    // can't be crossed by the elbow's vertical run.
    const belowBothRows: TaskBarBox = {
      left: 200,
      right: 300,
      top: 200,
      height: 40,
    };

    const [, { x: midX }] = buildElbowPoints(source, target, [belowBothRows]);
    const [, { x: defaultMidX }] = buildElbowPoints(source, target);
    expect(midX).toBe(defaultMidX);
  });

  it("falls back to the default midpoint when every position between the endpoints is blocked (residual case — full obstacle avoidance is out of scope)", () => {
    const source: TaskBarBox = { left: 0, right: 100, top: 0, height: 40 };
    const target: TaskBarBox = { left: 400, right: 500, top: 80, height: 40 };
    // Covers the entire routable span between the two bars.
    const wallToWallObstacle: TaskBarBox = {
      left: 100,
      right: 400,
      top: 40,
      height: 40,
    };

    const [, { x: midX }] = buildElbowPoints(source, target, [
      wallToWallObstacle,
    ]);
    const [, { x: defaultMidX }] = buildElbowPoints(source, target);
    expect(midX).toBe(defaultMidX);
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

describe("buildElbowPoints — dependency type anchoring", () => {
  // Same two boxes throughout, so only the anchor (and therefore the
  // resulting points) differ between the four types.
  const source: TaskBarBox = { left: 0, right: 100, top: 0, height: 40 };
  const target: TaskBarBox = { left: 200, right: 300, top: 80, height: 40 };

  it("fs (the default) anchors source-end to target-start", () => {
    const points = buildElbowPoints(source, target, [], "fs");
    expect(points[0]).toEqual({ x: 100, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 200, y: 100 });
  });

  it("ss anchors source-start to target-start", () => {
    const points = buildElbowPoints(source, target, [], "ss");
    expect(points[0]).toEqual({ x: 0, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 200, y: 100 });
  });

  it("ff anchors source-end to target-end", () => {
    const points = buildElbowPoints(source, target, [], "ff");
    expect(points[0]).toEqual({ x: 100, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 300, y: 100 });
  });

  it("sf anchors source-start to target-end", () => {
    const points = buildElbowPoints(source, target, [], "sf");
    expect(points[0]).toEqual({ x: 0, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 300, y: 100 });
  });

  it("leaves the source box in the anchor's own direction before it ever turns", () => {
    for (const type of ["fs", "ss", "ff", "sf"] as const) {
      const points = buildElbowPoints(source, target, [], type);
      // The first point after the source anchor (the exit point) sits on the
      // correct side of the source box for that anchor's direction — a
      // regression here would mean the elbow immediately doubles back across
      // the bar it just left.
      const exitsRight = type === "fs" || type === "ff";
      const exitPoint = points[1];
      if (exitsRight) {
        expect(exitPoint.x).toBeGreaterThanOrEqual(source.right);
      } else {
        expect(exitPoint.x).toBeLessThanOrEqual(source.left);
      }
    }
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

  it("routes an edge's elbow around a third task's bar that sits between its two endpoints", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 0, right: 100, top: 0, height: 40 }],
      ["b", { left: 400, right: 500, top: 80, height: 40 }],
      ["c", { left: 200, right: 300, top: 40, height: 40 }],
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
    // Both interior corners of the elbow (source-row turn and target-row
    // turn) sit at the same x — the chosen vertical run's position — as the
    // first number after each rounded corner's `Q`.
    const cornerX = Number(edge.path.match(/Q ([\d.]+) /)?.[1]);
    expect(Number.isNaN(cornerX)).toBe(false);
    expect(cornerX <= 196 || cornerX >= 304).toBe(true);
  });

  it("anchors a 'blocks' edge by its stored dependencyType", () => {
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
        dependencyType: "ss",
      },
    ];

    const [edge] = buildDependencyEdges(edges, boxes);
    expect(edge.sourcePoint).toEqual({ x: 0, y: 20 });
    expect(edge.targetPoint).toEqual({ x: 200, y: 100 });
  });

  it("ignores a 'related' edge's stored dependencyType and always anchors fs", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 0, right: 100, top: 0, height: 40 }],
      ["b", { left: 200, right: 300, top: 80, height: 40 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "e1",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "related",
        // A "related" relation always stores the fs/0 defaults server-side,
        // but even a stray non-default value must never change its anchor.
        dependencyType: "ff",
      },
    ];

    const [edge] = buildDependencyEdges(edges, boxes);
    expect(edge.sourcePoint).toEqual({ x: 100, y: 20 });
    expect(edge.targetPoint).toEqual({ x: 200, y: 100 });
  });

  it("carries a lag label point only for a 'blocks' edge with a non-zero lag", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 0, right: 100, top: 0, height: 40 }],
      ["b", { left: 200, right: 300, top: 80, height: 40 }],
    ]);

    const [zeroLag] = buildDependencyEdges(
      [
        {
          id: "e1",
          sourceTaskId: "a",
          targetTaskId: "b",
          relationType: "blocks",
          lagDays: 0,
        },
      ],
      boxes,
    );
    expect(zeroLag.lagLabelPoint).toBeNull();

    const [withLag] = buildDependencyEdges(
      [
        {
          id: "e2",
          sourceTaskId: "a",
          targetTaskId: "b",
          relationType: "blocks",
          lagDays: 3,
        },
      ],
      boxes,
    );
    expect(withLag.lagLabelPoint).not.toBeNull();

    // A "related" edge never carries lag, even if the row happened to store
    // a non-zero value.
    const [related] = buildDependencyEdges(
      [
        {
          id: "e3",
          sourceTaskId: "a",
          targetTaskId: "b",
          relationType: "related",
          lagDays: 5,
        },
      ],
      boxes,
    );
    expect(related.lagLabelPoint).toBeNull();
  });

  it("never routes to the left of the leftmost bar by more than the small exit gap, so the connector cannot bleed toward the task rail", () => {
    const source: TaskBarBox = { left: 500, right: 560, top: 0, height: 40 };
    const target: TaskBarBox = { left: 480, right: 540, top: 40, height: 40 };

    const points = buildElbowPoints(source, target);
    const minX = Math.min(...points.map((p) => p.x));
    expect(minX).toBeGreaterThanOrEqual(480 - 14 - 1);
  });
});
