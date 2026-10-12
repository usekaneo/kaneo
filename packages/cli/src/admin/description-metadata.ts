function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function metadataWithDescription(
  metadata: unknown,
  description: string,
): Record<string, unknown> | undefined {
  const record = asRecord(metadata);
  if (!record || !("description" in record)) return undefined;
  return { ...record, description };
}
