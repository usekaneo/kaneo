export function relativeTime(value?: string) {
  if (!value) return undefined;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return undefined;
  const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
  if (days >= 365) return `${Math.floor(days / 365)}y`;
  if (days >= 1) return `${days}d`;
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3600000));
  return hours ? `${hours}h` : "Just now";
}
