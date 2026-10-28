// Distinct names in first-seen order; filters compare names ignoring case
// and surrounding whitespace, as the API does.
export function uniqueNames(names: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = name.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name.trim());
  }
  return result;
}
