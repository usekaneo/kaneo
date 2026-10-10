import { basename } from "node:path";
import type { Ui } from "../render/ui.js";
import type { PluginAddResult } from "./plugin-add-result.js";
import type { ConfigUpdate } from "./update-config-file.js";

function configLines(
  ui: Ui,
  update: ConfigUpdate,
  packageName: string,
): string[] {
  const { theme, glyphs } = ui;
  const name = basename(update.file);
  switch (update.status) {
    case "created":
      return [`    Created ${name} with ${update.importName}() in plugins.`];
    case "updated":
      return [`    Added ${update.importName}() to plugins in ${name}.`];
    case "present":
      return [
        `    ${name} already imports ${packageName}, so it was left as is.`,
      ];
    case "manual":
      return [
        "",
        `  ${theme.warning(glyphs.warning)} Could not update ${name} safely: ${update.reason}. It was left as is. Add the plugin yourself:`,
        "",
        `      import ${update.importName} from "${packageName}";`,
        "",
        `    Then add ${update.importName}() to the plugins array in defineConfig({ ... }), or add plugins: [${update.importName}()] if there is none.`,
      ];
  }
}

export function renderPluginAdd(ui: Ui, result: PluginAddResult): string[] {
  const { theme, glyphs } = ui;
  return [
    "",
    `  ${theme.success(glyphs.tick)} Added ${theme.strong(result.packageName)} ${result.version} ${theme.muted(`${glyphs.separator} supports Kaneo ${result.range}`)}`,
    `    Installed ${result.installed.join(" and ")} in ${result.projectDir}.`,
    ...configLines(ui, result.config, result.packageName),
    "",
    `  ${theme.muted(`${glyphs.arrow} Next: check the options ${result.packageName} accepts in its README and pass them in kaneo.config.ts, then run kaneo plugin check and restart Kaneo. Workspace admins turn it on in Settings, then Workspace, then Plugins.`)}`,
    "",
  ];
}
