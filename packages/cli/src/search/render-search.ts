import { type Cell, text } from "../render/cell.js";
import { type Column, renderTable } from "../render/table.js";
import { statusDot } from "../render/task-format.js";
import type { Ui } from "../render/ui.js";
import {
  RESULT_TYPES,
  type SearchResultJson,
  type SearchResultType,
} from "./search-results.js";

export type SearchScreen = {
  readonly query: string;
  readonly results: ReadonlyArray<SearchResultJson>;
  readonly more: boolean;
  readonly limit: number;
};

const HEADINGS: Readonly<Record<SearchResultType, string>> = {
  task: "Tasks",
  project: "Projects",
  comment: "Comments",
  activity: "Activity",
  workspace: "Workspaces",
};

export function statusLabel(slug: string): string {
  return slug
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function columnsFor(
  ui: Ui,
  type: SearchResultType,
): Array<Column<SearchResultJson>> {
  const { theme } = ui;
  const reference: Column<SearchResultJson> = {
    header: "ID",
    cell: (result): Cell => [
      text(
        result.ticketId ?? result.projectKey ?? result.id.slice(0, 8),
        theme.muted,
        result.url ?? undefined,
      ),
    ],
  };
  switch (type) {
    case "task":
      return [
        reference,
        {
          header: "Title",
          flex: true,
          minWidth: 16,
          cell: (result) => [
            text(result.title, undefined, result.url ?? undefined),
          ],
        },
        {
          header: "Status",
          optional: true,
          cell: (result) =>
            result.status
              ? [
                  statusDot(ui, result.status, false),
                  text(` ${statusLabel(result.status)}`, theme.muted),
                ]
              : [],
        },
      ];
    case "project":
      return [
        reference,
        {
          header: "Name",
          flex: true,
          minWidth: 16,
          cell: (result) => [
            text(result.title, undefined, result.url ?? undefined),
          ],
        },
      ];
    case "workspace":
      return [
        {
          header: "Name",
          flex: true,
          minWidth: 16,
          cell: (result) => [
            text(result.title, undefined, result.url ?? undefined),
          ],
        },
      ];
    case "comment":
    case "activity":
      return [
        reference,
        {
          header: "Text",
          flex: true,
          minWidth: 16,
          cell: (result) => [
            text(
              result.snippet ?? result.title,
              undefined,
              result.url ?? undefined,
            ),
          ],
        },
        {
          header: "By",
          optional: true,
          cell: (result) =>
            result.author ? [text(result.author, theme.muted)] : [],
        },
      ];
  }
}

export function renderSearch(ui: Ui, screen: SearchScreen): string[] {
  const { theme } = ui;
  if (screen.results.length === 0) {
    return ["", `  ${theme.muted(`No results for "${screen.query}".`)}`, ""];
  }
  const lines = [""];
  for (const type of RESULT_TYPES) {
    const group = screen.results.filter((result) => result.type === type);
    if (group.length === 0) continue;
    lines.push(
      `  ${theme.strong(HEADINGS[type])} ${theme.muted(String(group.length))}`,
      ...renderTable(ui, group, columnsFor(ui, type), {
        width: ui.caps.columns,
        indent: 4,
      }),
      "",
    );
  }
  if (screen.more) {
    lines.push(
      `  ${theme.muted(
        screen.limit < 50
          ? "There are more matches. Pass --limit (up to 50) to see more."
          : "There are more matches. Pass --type or -p to narrow the search.",
      )}`,
      "",
    );
  }
  return lines;
}
