import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import type { ActivityEntry } from "./describe-activity.js";
import { relativeTime } from "./relative-time.js";
import { renderTaskHeading } from "./render-task-heading.js";

export type ActivityView = {
  readonly label: string;
  readonly title: string;
  readonly url: string;
  readonly entries: ReadonlyArray<ActivityEntry>;
  readonly more: boolean;
  readonly now: Date;
};

export function renderActivity(ui: Ui, view: ActivityView): string[] {
  const { theme } = ui;
  const heading = renderTaskHeading(ui, {
    label: view.label,
    title: view.title,
    url: view.url,
    meta: "Activity",
  });
  if (view.entries.length === 0) {
    return ["", heading, "", `  ${theme.muted("No activity yet.")}`, ""];
  }
  const rows = renderTable(
    ui,
    view.entries,
    [
      {
        header: "When",
        cell: (entry): Cell => [
          text(relativeTime(new Date(entry.createdAt), view.now), theme.muted),
        ],
      },
      {
        header: "Event",
        flex: true,
        minWidth: 16,
        cell: (entry): Cell => [
          text(entry.actor?.name ?? "Someone", theme.strong),
          text(` ${entry.summary}`),
          ...(entry.detail ? [text(`: ${entry.detail}`, theme.muted)] : []),
        ],
      },
    ],
    { width: ui.caps.columns, indent: 2, gap: 2 },
  );
  const lines = ["", heading, ""];
  if (view.more) {
    lines.push(
      `  ${theme.muted(`Showing the latest ${view.entries.length === 1 ? "event" : `${view.entries.length} events`}. Pass --limit to see more.`)}`,
      "",
    );
  }
  return [...lines, ...rows, ""];
}
