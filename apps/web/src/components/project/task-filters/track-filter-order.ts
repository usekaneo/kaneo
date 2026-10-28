export function trackFilterOrder(order: string[], activeIds: string[]) {
  const active = new Set(activeIds);
  const kept = order.filter((id) => active.has(id));
  const added = activeIds.filter((id) => !kept.includes(id));
  return [...kept, ...added];
}
