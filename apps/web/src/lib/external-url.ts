export function getExternalWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function openExternalWebUrl(value: string): void {
  const url = getExternalWebUrl(value);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
