export function getUrlHost(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).host || trimmed;
  } catch {
    return trimmed;
  }
}
