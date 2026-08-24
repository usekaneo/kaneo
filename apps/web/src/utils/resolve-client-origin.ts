export function resolveClientOrigin(
  configuredOrigin: string | undefined,
  browserOrigin: string,
) {
  const value = configuredOrigin?.trim();
  if (!value) {
    return browserOrigin;
  }

  try {
    const url = new URL(value);
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    ) {
      return url.origin;
    }
  } catch {}

  return browserOrigin;
}
