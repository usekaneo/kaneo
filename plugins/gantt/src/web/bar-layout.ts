export const MIN_INLINE_LABEL_PX = 120;
export const MIN_TOUCH_RESIZABLE_PX = 120;

type BarLayoutInput = {
  isMobile: boolean;
  barWidthPx: number;
  lineEnd: number;
  trackCount: number;
};

export function getBarLayout({
  isMobile,
  barWidthPx,
  lineEnd,
  trackCount,
}: BarLayoutInput): { labelOutside: boolean; showResizeHandles: boolean } {
  return {
    labelOutside:
      isMobile && barWidthPx < MIN_INLINE_LABEL_PX && lineEnd <= trackCount,
    showResizeHandles: !isMobile || barWidthPx >= MIN_TOUCH_RESIZABLE_PX,
  };
}
