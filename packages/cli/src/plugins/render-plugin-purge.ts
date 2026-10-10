import type { Ui } from "../render/ui.js";

export type PluginPurgeResult = {
  readonly pluginId: string;
  readonly storage: number;
  readonly workspaces: number;
};

function rows(count: number): string {
  return `${count} ${count === 1 ? "row" : "rows"}`;
}

export function renderPluginPurge(ui: Ui, result: PluginPurgeResult): string[] {
  const { theme, glyphs } = ui;
  if (result.storage === 0 && result.workspaces === 0) {
    return [
      "",
      `  ${theme.muted(glyphs.dot)} ${theme.strong(result.pluginId)} had no stored data. Nothing was deleted.`,
      "",
    ];
  }
  return [
    "",
    `  ${theme.success(glyphs.tick)} Purged ${theme.strong(result.pluginId)}`,
    `    Deleted ${rows(result.storage)} from plugin_storage and ${rows(result.workspaces)} from workspace_plugin.`,
    "",
  ];
}
