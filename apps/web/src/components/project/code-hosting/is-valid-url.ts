export function isValidUrl(value: string) {
  try {
    new URL(value.trim());
    return true;
  } catch {
    return false;
  }
}
