import { renderCell, text } from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import { formatDuration } from "./duration.js";

export type TimerStatusView = {
  readonly label: string;
  readonly url: string;
  readonly title: string;
  readonly startedAt: string;
  readonly elapsedSeconds: number;
  readonly note: string | null;
} | null;

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function renderTimerStatus(ui: Ui, view: TimerStatusView): string[] {
  const { theme, glyphs } = ui;
  if (view === null) {
    return [
      "",
      `  ${theme.muted(glyphs.dot)} No timer running`,
      "",
      `  ${theme.muted("Start one with")} ${theme.strong("kaneo time start <task>")}`,
      "",
    ];
  }
  const label = renderCell([text(view.label, theme.strong, view.url)], ui);
  const since = `${theme.muted("since")} ${clock(view.startedAt)}`;
  return [
    "",
    `  ${theme.success(glyphs.dot)} ${label} ${theme.muted(glyphs.separator)} ${view.title}`,
    `    ${theme.strong(formatDuration(view.elapsedSeconds))} ${since}${view.note ? ` ${theme.muted(glyphs.separator)} ${view.note}` : ""}`,
    "",
  ];
}
