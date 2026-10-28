import type { Environment } from "../render/capabilities.js";

export type OutputMode = "json" | "human";

export function resolveOutputMode(
  argv: ReadonlyArray<string>,
  env: Environment,
  stdoutIsTTY: boolean,
): OutputMode {
  const end = argv.indexOf("--");
  const flags = end === -1 ? argv : argv.slice(0, end);
  if (flags.includes("--json")) return "json";
  if (flags.some((flag) => flag === "--jq" || flag.startsWith("--jq=")))
    return "json";
  if (flags.includes("--human")) return "human";
  if (env.KANEO_JSON === "true" || env.KANEO_JSON === "1") return "json";
  return stdoutIsTTY ? "human" : "json";
}
