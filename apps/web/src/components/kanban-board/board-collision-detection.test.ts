import type { ClientRect, DroppableContainer } from "@dnd-kit/core";
import { describe, expect, it } from "vite-plus/test";
import { boardCollisionDetection } from "./board-collision-detection";

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } as ClientRect;
}

const rects = new Map([
  ["empty-column", rect(0, 100, 300, 700)],
  ["neighbor-card", rect(320, 100, 300, 80)],
]);

function detect(pointer: { x: number; y: number } | null) {
  const droppableContainers = [...rects.keys()].map(
    (id) => ({ id, disabled: false }) as unknown as DroppableContainer,
  );
  return boardCollisionDetection({
    active: { id: "card" } as never,
    collisionRect: rect(100, 220, 300, 80),
    droppableRects: rects,
    droppableContainers,
    pointerCoordinates: pointer,
  }).map((collision) => collision.id);
}

describe("boardCollisionDetection", () => {
  it("targets the empty column under the pointer over a closer card", () => {
    expect(detect({ x: 150, y: 260 })).toEqual(["empty-column"]);
  });

  it("finds nothing when the pointer is between columns", () => {
    expect(detect({ x: 310, y: 260 })).toEqual([]);
  });

  it("falls back to corner distance without a pointer", () => {
    expect(detect(null)[0]).toBe("neighbor-card");
  });
});
