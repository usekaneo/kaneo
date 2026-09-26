import { describe, expect, it } from "vitest";
import type { TaskBarBox } from "./dependency-lines";
import { findLinkDropTarget, linkSourceAnchorPoint } from "./gantt-link-drag";

function box(overrides: Partial<TaskBarBox> = {}): TaskBarBox {
  return { left: 100, right: 200, top: 40, height: 20, ...overrides };
}

describe("linkSourceAnchorPoint", () => {
  it("anchors at the box's right edge, vertically centered", () => {
    expect(
      linkSourceAnchorPoint(box({ left: 0, right: 100, top: 10, height: 30 })),
    ).toEqual({
      x: 100,
      y: 25,
    });
  });
});

describe("findLinkDropTarget", () => {
  const source = box({ left: 0, right: 100, top: 0, height: 40 });
  const target = box({ left: 200, right: 300, top: 0, height: 40 });
  const candidates = [
    { taskId: "source", box: source },
    { taskId: "target", box: target },
  ];

  it("returns the task id of the bar the point is released over", () => {
    expect(findLinkDropTarget({ x: 250, y: 20 }, candidates, "source")).toBe(
      "target",
    );
  });

  it("returns null when released over empty space between bars", () => {
    expect(
      findLinkDropTarget({ x: 150, y: 20 }, candidates, "source"),
    ).toBeNull();
  });

  it("returns null (cancels) when released back over the source bar itself", () => {
    expect(
      findLinkDropTarget({ x: 50, y: 20 }, candidates, "source"),
    ).toBeNull();
  });

  it("returns null when there are no candidates at all", () => {
    expect(findLinkDropTarget({ x: 50, y: 20 }, [], "source")).toBeNull();
  });

  it("picks the first matching candidate when boxes overlap", () => {
    const overlapping = [
      { taskId: "back", box: box({ left: 0, right: 100, top: 0, height: 40 }) },
      {
        taskId: "front",
        box: box({ left: 50, right: 150, top: 0, height: 40 }),
      },
    ];
    expect(findLinkDropTarget({ x: 75, y: 20 }, overlapping, "source")).toBe(
      "back",
    );
  });

  it("treats the box bounds as inclusive at the edges", () => {
    expect(findLinkDropTarget({ x: 200, y: 0 }, candidates, "source")).toBe(
      "target",
    );
  });
});
