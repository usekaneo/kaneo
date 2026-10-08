export function formatJqResults(results: ReadonlyArray<unknown>): string {
  return results
    .map(
      (value) =>
        `${typeof value === "string" ? value : (JSON.stringify(value) ?? "null")}\n`,
    )
    .join("");
}
