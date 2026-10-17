// Renamed columns keep their slug because it is also the task status, so a
// new column's name can derive a slug that is already taken.
export function availableSlug(base: string, taken: ReadonlySet<string>) {
  let slug = base;
  for (let suffix = 2; taken.has(slug); suffix++) {
    slug = `${base}-${suffix}`;
  }
  return slug;
}
