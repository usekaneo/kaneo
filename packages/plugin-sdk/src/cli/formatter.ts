import { CliOutput } from "effect/cli";
import type { OutputShape } from "./output/output.js";

export function makeFormatter(output: OutputShape): CliOutput.Formatter {
  const base = CliOutput.defaultFormatter({ colors: output.theme.color });
  return {
    ...base,
    formatVersion: (name, version) =>
      output.mode === "json"
        ? JSON.stringify({ name, version })
        : `${name} ${version}`,
  };
}
