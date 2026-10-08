import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { PluginPackage } from "../package/parse-plugin-package.js";
import { listFiles } from "./list-files.js";
import { log } from "./log.js";

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

export async function printSummary(root: string, plugin: PluginPackage) {
  const files = await listFiles(root, "dist");
  const width = Math.max(0, ...files.map((file) => file.length));
  const engines = plugin.engines ? ` for Kaneo ${plugin.engines}` : "";
  log.success(
    `Built ${plugin.name} (${plugin.id}) ${plugin.version}${engines}`,
  );
  for (const file of files) {
    const { size } = await stat(join(root, file));
    log.info(`  ${file.padEnd(width)}  ${formatSize(size)}`);
  }
}
