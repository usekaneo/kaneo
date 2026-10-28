import type { LinkJson } from "../external-links/link-json.js";
import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import { sectionTitle } from "./section-title.js";

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//u, "").replace(/\/$/u, "");
}

export function renderLinks(ui: Ui, links: ReadonlyArray<LinkJson>): string[] {
  if (links.length === 0) return [];
  const { theme } = ui;
  return [
    sectionTitle(ui, "Links"),
    ...renderTable(
      ui,
      links,
      [
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
          cell: (link): Cell =>
            link.source === "manual" ? [] : [text(link.source, theme.muted)],
        },
      ],
      { width: ui.caps.columns, indent: 4, gap: 2 },
    ),
    "",
  ];
}
