export function visitRecords(
  value: unknown,
  callback: (record: Record<string, unknown>) => void,
) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) visitRecords(item, callback);
    return;
  }
  const record = value as Record<string, unknown>;
  callback(record);
  for (const item of Object.values(record)) visitRecords(item, callback);
}
