import { type Cell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { formatDuration } from "../time/duration.js";
import type { TimeSummaryJson } from "./time-summary.js";

export function hasTrackedTime(time: TimeSummaryJson): boolean {
  return time.totalSeconds > 0 || time.running.length > 0;
}

export function timeValue(ui: Ui, time: TimeSummaryJson): Cell {
  const { theme, glyphs } = ui;
  const total = text(formatDuration(time.totalSeconds));
  if (time.running.length === 0) return [total];
  const names = [
    ...new Set(time.running.map((timer) => timer.user?.name ?? "someone")),
  ];
  return [
    total,
    text(` ${glyphs.separator} `, theme.muted),
    text(`${glyphs.dot} Timer running`, theme.success),
    text(` (${names.join(", ")})`, theme.muted),
  ];
}
