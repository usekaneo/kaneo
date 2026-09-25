import { describe, expect, it } from "vitest";
import {
  buildDependencyEdges,
  type DependencyEdgeInput,
  type TaskBarBox,
} from "./dependency-lines";

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
    expect(edge.path.startsWith("M 100 20 C")).toBe(true);
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
    expect(edge.path).toMatch(/^M 260 20 C/);
  });

  it("caps the curve offset for very distant bars instead of growing unbounded", () => {
    const boxes = new Map<string, TaskBarBox>([
      ["a", { left: 0, right: 100, top: 0, height: 40 }],
      ["b", { left: 10_000, right: 10_100, top: 0, height: 40 }],
    ]);
    const edges: DependencyEdgeInput[] = [
      {
        id: "e1",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "related",
      },
    ];

    const [edge] = buildDependencyEdges(edges, boxes);

    // "M 100 20 C 220 20, 9880 20, 10000 20" — the 120 offset (100 -> 220)
    // is the capped MAX_CURVE_OFFSET, not half of the ~9900px gap.
    expect(edge.path).toBe("M 100 20 C 220 20, 9880 20, 10000 20");
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
});
