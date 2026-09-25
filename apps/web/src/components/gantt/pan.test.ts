import { describe, expect, it } from "vitest";
import { computePanScrollPosition } from "./pan";

describe("computePanScrollPosition", () => {
  it("scrolls left when the pointer moves right (grab-and-pull)", () => {
    const result = computePanScrollPosition({
      startScrollLeft: 200,
      startScrollTop: 50,
      deltaX: 80,
      deltaY: 0,
    });
    expect(result).toEqual({ scrollLeft: 120, scrollTop: 50 });
  });

  it("scrolls right when the pointer moves left", () => {
    const result = computePanScrollPosition({
      startScrollLeft: 200,
      startScrollTop: 50,
      deltaX: -80,
      deltaY: 0,
    });
    expect(result).toEqual({ scrollLeft: 280, scrollTop: 50 });
  });

  it("moves vertically the same way", () => {
    const result = computePanScrollPosition({
      startScrollLeft: 0,
      startScrollTop: 100,
      deltaX: 0,
      deltaY: 40,
    });
    expect(result).toEqual({ scrollLeft: 0, scrollTop: 60 });
  });

  it("is a no-op for zero movement", () => {
    const result = computePanScrollPosition({
      startScrollLeft: 10,
      startScrollTop: 10,
      deltaX: 0,
      deltaY: 0,
    });
    expect(result).toEqual({ scrollLeft: 10, scrollTop: 10 });
  });
});
