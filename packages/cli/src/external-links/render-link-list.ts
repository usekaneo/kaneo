import { type Cell, renderCell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import type { LinkJson } from "./link-json.js";

export type LinkListView = {
  readonly taskLabel: string;
  readonly taskTitle: string;
  readonly taskUrl: string;
  readonly links: ReadonlyArray<LinkJson>;
};

export const SHORT_ID = 8;

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//u, "").replace(/\/$/u, "");
}

export function renderLinkList(ui: Ui, view: LinkListView): string[] {
  const { theme, glyphs } = ui;
  const header = `  ${renderCell([text(view.taskLabel, theme.strong, view.taskUrl)], ui)} ${theme.muted(glyphs.separator)} ${view.taskTitle}`;
  if (view.links.length === 0) {
    return [
      "",
      header,
      "",
      `  ${theme.muted(`No links yet. Add one with kaneo task link add ${view.taskLabel} <url>.`)}`,
      "",
    ];
  }
  return [
    "",
    header,
    "",
    ...renderTable(
      ui,
      view.links,
      [
        {
          header: "ID",
          cell: (link): Cell => [text(link.id.slice(0, SHORT_ID), theme.muted)],
        },
        {
          header: "Title",
          flex: true,
          minWidth: 12,
          cell: (link): Cell => [
            text(link.title ?? displayUrl(link.url), undefined, link.url),
          ],
        },
        {
          header: "URL",
          flex: true,
          optional: true,
          minWidth: 16,
          cell: (link): Cell =>
            link.title
              ? [text(displayUrl(link.url), theme.info, link.url)]
              : [],
        },
        {
          header: "Source",
          optional: true,
          cell: (link): Cell => [text(link.source, theme.muted)],
        },
      ],
      { width: ui.caps.columns, indent: 4, gap: 2 },
    ),
    "",
  ];
}
