import { CliOutput } from "effect/cli";
import type { OutputShape } from "../output/output.js";
import { logo } from "../render/logo.js";

export function makeFormatter(output: OutputShape): CliOutput.Formatter {
  const base = CliOutput.defaultFormatter({
    colors: output.mode === "human" && output.ui.caps.color > 0,
  });
  return {
    ...base,
    formatVersion: (name, version) => {
      if (output.mode === "json") return JSON.stringify({ name, version });
      const { theme, glyphs } = output.ui;
      return [
        "",
        ...logo(output.ui),
        "",
        `  ${theme.strong(name)} ${version} ${theme.muted(`${glyphs.separator} node ${process.version}`)}`,
        "",
      ].join("\n");
    },
  };
}
