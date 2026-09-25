import { describe, expect, it } from "vitest";
import {
  clampGanttZoom,
  MAX_GANTT_ZOOM,
  MIN_GANTT_ZOOM,
  nextGanttZoom,
  scrollLeftForZoom,
} from "./zoom";

describe("clampGanttZoom", () => {
  it("passes values already inside the range through unchanged", () => {
    expect(clampGanttZoom(1)).toBe(1);
  });
  it("clamps to the minimum", () => {
    expect(clampGanttZoom(0.01)).toBe(MIN_GANTT_ZOOM);
  });
  it("clamps to the maximum", () => {
    expect(clampGanttZoom(50)).toBe(MAX_GANTT_ZOOM);
  });
});

describe("nextGanttZoom", () => {
  it("zooms in on negative deltaY (scrolling up/toward the user)", () => {
    expect(nextGanttZoom(1, -100)).toBeGreaterThan(1);
  });
  it("zooms out on positive deltaY (scrolling down/away)", () => {
    expect(nextGanttZoom(1, 100)).toBeLessThan(1);
  });
  it("is a no-op for a zero delta", () => {
    expect(nextGanttZoom(1, 0)).toBe(1);
  });
  it("never goes below the minimum even for a huge zoom-out gesture", () => {
    expect(nextGanttZoom(1, 100000)).toBe(MIN_GANTT_ZOOM);
  });
  it("never exceeds the maximum even for a huge zoom-in gesture", () => {
    expect(nextGanttZoom(1, -100000)).toBe(MAX_GANTT_ZOOM);
  });
});

describe("scrollLeftForZoom", () => {
  it("keeps scrollLeft unchanged when the zoom doesn't actually change", () => {
    const result = scrollLeftForZoom({
      scrollLeft: 400,
      pointerX: 120,
      railWidthPx: 320,
      oldZoom: 1,
      newZoom: 1,
    });
    expect(result).toBe(400);
  });

  it("keeps the day under the pointer fixed when zooming in (no rail offset)", () => {
    // contentX under the pointer = 150 (old scale); doubling the scale moves
    // that same day to 300, so scrollLeft must grow by 150 to keep it under
    // the same pointerX.
    const result = scrollLeftForZoom({
      scrollLeft: 100,
      pointerX: 50,
      railWidthPx: 0,
      oldZoom: 1,
      newZoom: 2,
    });
    expect(result).toBe(250);
  });

  it("leaves the rail region's own width out of the scaling", () => {
    const railWidthPx = 320;
    const result = scrollLeftForZoom({
      scrollLeft: 100,
      pointerX: 50,
      railWidthPx,
      oldZoom: 1,
      newZoom: 2,
    });
    // dayContentX = 100 + 50 - 320 = -170 (pointer is still within the rail
    // region here); scaled = -340; scrollLeft = 320 + -340 - 50 = -70.
    expect(result).toBe(-70);
  });

  it("keeps a point beyond the rail fixed under the pointer", () => {
    const railWidthPx = 320;
    const result = scrollLeftForZoom({
      scrollLeft: 100,
      pointerX: 570,
      railWidthPx,
      oldZoom: 1,
      newZoom: 2,
    });
    // dayContentX = 100 + 570 - 320 = 350; scaled = 700;
    // scrollLeft = 320 + 700 - 570 = 450.
    expect(result).toBe(450);

    // Re-deriving forward: with the NEW scrollLeft, the same pointerX must
    // land back on dayContentX * 2 (350 * 2 = 700) relative to the rail.
    expect(result + 570 - railWidthPx).toBe(700);
  });

  it("halves the effective scroll distance when zooming out to half scale", () => {
    const result = scrollLeftForZoom({
      scrollLeft: 300,
      pointerX: 100,
      railWidthPx: 0,
      oldZoom: 1,
      newZoom: 0.5,
    });
    // dayContentX = 400; scaled = 200; scrollLeft = 200 - 100 = 100.
    expect(result).toBe(100);
  });
});
