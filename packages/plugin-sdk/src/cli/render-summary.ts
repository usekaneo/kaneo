import type { BuildResult } from "./build-result.js";
import type { Theme } from "./output/theme.js";

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

export function renderSummary(theme: Theme, result: BuildResult): string[] {
  const { plugin, files } = result;
  const width = Math.max(0, ...files.map((file) => file.path.length));
  const engines = plugin.engines ? ` for Kaneo ${plugin.engines}` : "";
  return [
    theme.success(
      `Built ${plugin.name} (${plugin.id}) ${plugin.version}${engines}`,
    ),
    ...files.map(
      (file) => `  ${file.path.padEnd(width)}  ${formatSize(file.bytes)}`,
    ),
  ];
}
