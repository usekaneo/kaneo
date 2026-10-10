export function batches<A>(
  items: ReadonlyArray<A>,
  size: number,
): ReadonlyArray<ReadonlyArray<A>> {
  const result: A[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}
