export function parseWidth(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  // `Number.parseInt` stops at the first non-digit and discards the rest, so it
  // would read `50%` as 50 pixels. Match the whole value instead, so only a
  // pixel count gets through and every other unit is rejected.
  const match = /^(\d+)(?:px)?$/i.exec(String(value ?? "").trim());
  if (!match) return null;

  const width = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(width) && width > 0 ? width : null;
}
