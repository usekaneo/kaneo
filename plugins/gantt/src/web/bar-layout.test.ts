import { describe, expect, it } from "vite-plus/test";
import {
  getBarLayout,
  MIN_INLINE_LABEL_PX,
  MIN_TOUCH_RESIZABLE_PX,
} from "./bar-layout.js";

describe("getBarLayout", () => {
  it("keeps the label inside and both resize handles on desktop", () => {
    expect(
      getBarLayout({
        isMobile: false,
        barWidthPx: 20,
        lineEnd: 3,
        trackCount: 91,
      }),
    ).toEqual({ labelOutside: false, showResizeHandles: true });
  });

  it("moves a short phone bar's label beside it and drops its resize handles", () => {
    expect(
      getBarLayout({
        isMobile: true,
        barWidthPx: MIN_INLINE_LABEL_PX - 1,
        lineEnd: 3,
        trackCount: 91,
      }),
    ).toEqual({ labelOutside: true, showResizeHandles: false });
  });

  it("keeps the label inside a short phone bar that ends at the edge of the timeline", () => {
    expect(
      getBarLayout({
        isMobile: true,
        barWidthPx: 50,
        lineEnd: 92,
        trackCount: 91,
      }).labelOutside,
    ).toBe(false);
  });

  it("keeps the label and resize handles on a phone bar wide enough for them", () => {
    expect(
      getBarLayout({
        isMobile: true,
        barWidthPx: Math.max(MIN_INLINE_LABEL_PX, MIN_TOUCH_RESIZABLE_PX),
        lineEnd: 10,
        trackCount: 91,
      }),
    ).toEqual({ labelOutside: false, showResizeHandles: true });
  });
});
