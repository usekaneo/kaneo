import { describe, expect, it } from "vitest";
import {
  buildTaskHierarchy,
  computeParentSummarySpans,
  computeSummarySpan,
  flattenGanttRows,
  type ScheduleSpan,
} from "./gantt-hierarchy";

describe("buildTaskHierarchy", () => {
  it("groups children under their parent from source->parent, target->child subtask relations", () => {
    const hierarchy = buildTaskHierarchy(
      ["parent", "child-a", "child-b"],
      [
        { sourceTaskId: "parent", targetTaskId: "child-a" },
        { sourceTaskId: "parent", targetTaskId: "child-b" },
      ],
    );

    expect(hierarchy.childrenByParentId.get("parent")).toEqual([
      "child-a",
      "child-b",
    ]);
    expect(hierarchy.parentIdByChildId.get("child-a")).toBe("parent");
    expect(hierarchy.parentIdByChildId.get("child-b")).toBe("parent");
  });

  it("ignores a relation whose source or target isn't among the known task ids", () => {
    const hierarchy = buildTaskHierarchy(
      ["parent"],
      [{ sourceTaskId: "parent", targetTaskId: "missing-child" }],
    );

    expect(hierarchy.childrenByParentId.size).toBe(0);
    expect(hierarchy.parentIdByChildId.size).toBe(0);
  });

  it("caps nesting at one level: a grandchild relation is not reflected in the hierarchy", () => {
    // grandparent -> parent -> grandchild. "parent" is itself a subtask of
    // "grandparent", so it cannot also head its own summary row/children.
    const hierarchy = buildTaskHierarchy(
      ["grandparent", "parent", "grandchild"],
      [
        { sourceTaskId: "grandparent", targetTaskId: "parent" },
        { sourceTaskId: "parent", targetTaskId: "grandchild" },
      ],
    );

    expect(hierarchy.childrenByParentId.get("grandparent")).toEqual(["parent"]);
    expect(hierarchy.childrenByParentId.has("parent")).toBe(false);
    expect(hierarchy.parentIdByChildId.get("parent")).toBe("grandparent");
    // The grandchild is simply not part of the hierarchy at all — it stays
    // an ordinary, unparented row.
    expect(hierarchy.parentIdByChildId.has("grandchild")).toBe(false);
  });

  it("keeps a child's first parent when more than one relation claims it", () => {
    const hierarchy = buildTaskHierarchy(
      ["parent-1", "parent-2", "child"],
      [
        { sourceTaskId: "parent-1", targetTaskId: "child" },
        { sourceTaskId: "parent-2", targetTaskId: "child" },
      ],
    );

    expect(hierarchy.parentIdByChildId.get("child")).toBe("parent-1");
    expect(hierarchy.childrenByParentId.get("parent-1")).toEqual(["child"]);
    expect(hierarchy.childrenByParentId.has("parent-2")).toBe(false);
  });
});

describe("computeSummarySpan", () => {
  it("returns null for no child spans", () => {
    expect(computeSummarySpan([])).toBeNull();
  });

  it("spans the earliest start to the latest end across all children", () => {
    const spans: ScheduleSpan[] = [
      { start: new Date("2026-01-10"), end: new Date("2026-01-15") },
      { start: new Date("2026-01-05"), end: new Date("2026-01-12") },
      { start: new Date("2026-01-08"), end: new Date("2026-01-20") },
    ];

    expect(computeSummarySpan(spans)).toEqual({
      start: new Date("2026-01-05"),
      end: new Date("2026-01-20"),
    });
  });
});

describe("computeParentSummarySpans", () => {
  it("rolls up a parent's span from only the children that have their own schedule", () => {
    const hierarchy = buildTaskHierarchy(
      ["parent", "child-a", "child-b", "child-no-dates"],
      [
        { sourceTaskId: "parent", targetTaskId: "child-a" },
        { sourceTaskId: "parent", targetTaskId: "child-b" },
        { sourceTaskId: "parent", targetTaskId: "child-no-dates" },
      ],
    );
    const ownSpanByTaskId = new Map<string, ScheduleSpan>([
      [
        "child-a",
        { start: new Date("2026-02-01"), end: new Date("2026-02-05") },
      ],
      [
        "child-b",
        { start: new Date("2026-02-03"), end: new Date("2026-02-10") },
      ],
      // A parent's own dates are intentionally not looked at here — only
      // its children's — since the Gantt route's rollup is meant to always
      // reflect "the span of the children", never a mix with the parent's
      // own dates.
      [
        "parent",
        { start: new Date("2026-01-01"), end: new Date("2026-01-02") },
      ],
    ]);

    const spans = computeParentSummarySpans(hierarchy, ownSpanByTaskId);

    expect(spans.get("parent")).toEqual({
      start: new Date("2026-02-01"),
      end: new Date("2026-02-10"),
    });
  });

  it("gives a parent no summary span when none of its children have a schedule", () => {
    const hierarchy = buildTaskHierarchy(
      ["parent", "child"],
      [{ sourceTaskId: "parent", targetTaskId: "child" }],
    );

    const spans = computeParentSummarySpans(hierarchy, new Map());

    expect(spans.has("parent")).toBe(false);
  });
});

describe("flattenGanttRows", () => {
  type Row = { id: string; scheduleStart: Date; label: string };

  function row(id: string, day: number, label = id): Row {
    return { id, scheduleStart: new Date(2026, 0, day), label };
  }

  it("inserts an expanded parent's children immediately after it, sorted by their own start date", () => {
    const parent = row("parent", 5);
    const external = row("external", 6); // between parent and children chronologically
    const childLate = row("child-b", 10);
    const childEarly = row("child-a", 8);

    const result = flattenGanttRows(
      [parent, external].sort(
        (a, b) => a.scheduleStart.getTime() - b.scheduleStart.getTime(),
      ),
      new Map([["parent", [childLate, childEarly]]]),
      new Set(),
    );

    expect(result.map((r) => r.id)).toEqual([
      "parent",
      "child-a",
      "child-b",
      "external",
    ]);
  });

  it("omits a collapsed parent's children entirely", () => {
    const parent = row("parent", 1);
    const child = row("child", 2);

    const result = flattenGanttRows(
      [parent],
      new Map([["parent", [child]]]),
      new Set(["parent"]),
    );

    expect(result.map((r) => r.id)).toEqual(["parent"]);
  });

  it("leaves a row with no children untouched", () => {
    const plain = row("plain", 1);
    const result = flattenGanttRows([plain], new Map(), new Set());
    expect(result).toEqual([plain]);
  });
});
