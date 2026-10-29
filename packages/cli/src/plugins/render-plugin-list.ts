import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import type { PluginJson } from "./plugin-json.js";

export function renderPluginList(
  ui: Ui,
  plugins: ReadonlyArray<PluginJson>,
): string[] {
  const { theme, glyphs } = ui;
  if (plugins.length === 0) {
    return [
      "",
      `  ${theme.muted("No plugins are installed on this server. See https://kaneo.app/docs/core/plugins to add one.")}`,
      "",
    ];
  }
  return [
    "",
    ...renderTable(
      ui,
      plugins,
      [
        {
          header: "Name",
          flex: true,
          minWidth: 10,
          cell: (plugin): Cell => [text(plugin.name, theme.strong)],
        },
        {
          header: "ID",
          flex: true,
          minWidth: 10,
          cell: (plugin): Cell => [text(plugin.id, theme.muted)],
        },
        {
          header: "Version",
          optional: true,
          cell: (plugin): Cell => [text(plugin.version)],
        },
        {
          header: "Built in",
          optional: true,
          cell: (plugin): Cell => [
            plugin.official ? text("yes") : text("no", theme.muted),
          ],
        },
        {
          header: "Enabled",
          cell: (plugin): Cell =>
            plugin.enabled
              ? [text(`${glyphs.tick} on`, theme.success)]
              : [text("off", theme.muted)],
        },
      ],
      { width: ui.caps.columns, indent: 2, gap: 2, header: true },
    ),
    "",
  ];
}
