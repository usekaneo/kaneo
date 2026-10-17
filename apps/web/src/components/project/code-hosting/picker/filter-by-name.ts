export function filterByName<Item>(
  items: Item[],
  term: string,
  name: (item: Item) => string,
) {
  const needle = term.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => name(item).toLowerCase().includes(needle));
}
