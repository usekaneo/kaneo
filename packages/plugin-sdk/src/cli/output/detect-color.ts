import type { Environment } from "../environment.js";

export function detectColor(env: Environment, isTTY: boolean): boolean {
  const forced = env.FORCE_COLOR;
  if (forced !== undefined) return forced !== "0" && forced !== "false";
  if (env.NO_COLOR) return false;
  if (env.TERM === "dumb") return false;
  return isTTY;
}
