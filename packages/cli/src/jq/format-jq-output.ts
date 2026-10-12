import { sanitizeText } from "../render/sanitize.js";

export function formatJqResults(results: ReadonlyArray<unknown>): string {
  return results
    .map(
      (value) =>
        `${typeof value === "string" ? sanitizeText(value) : (JSON.stringify(value) ?? "null")}\n`,
    )
    .join("");
}
