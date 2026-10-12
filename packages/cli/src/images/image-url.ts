const SCHEME = /^[a-z][a-z0-9+.-]*:/iu;

function parse(value: string, base?: string): URL | null {
  try {
    const url = base === undefined ? new URL(value) : new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function resolveImageUrl(raw: string, apiUrl: string): URL | null {
  const value = raw.trim();
  if (value === "") return null;
  if (value.startsWith("//")) {
    const api = parse(apiUrl);
    return api ? parse(`${api.protocol}${value}`) : null;
  }
  if (SCHEME.test(value)) return parse(value);
  if (value.startsWith("/")) return parse(`${apiUrl}${value}`);
  return parse(value, `${apiUrl}/`);
}

export function absoluteImageUrl(raw: string, apiUrl: string): string {
  return resolveImageUrl(raw, apiUrl)?.href ?? raw;
}

const ASSET_PATH = /\/api\/asset\/[^/]+$/u;

export function sendsToken(url: URL, apiUrl: string): boolean {
  const api = parse(apiUrl);
  return (
    api !== null && url.origin === api.origin && ASSET_PATH.test(url.pathname)
  );
}
