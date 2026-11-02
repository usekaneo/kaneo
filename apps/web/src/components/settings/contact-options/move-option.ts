// The key order after moving one key a step up or down; null when it can't move.
export function moveKey(
  keys: readonly string[],
  key: string,
  direction: "up" | "down",
) {
  const from = keys.indexOf(key);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= keys.length) return null;
  const next = [...keys];
  next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}
