export function assetEtag(
  version: string,
  size: number,
  mtimeMs: number,
): string {
  return `W/"${version}-${size.toString(36)}-${Math.trunc(mtimeMs).toString(36)}"`;
}

function opaque(tag: string): string {
  return tag.trim().replace(/^W\//, "");
}

export function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .some((tag) => tag.trim() === "*" || opaque(tag) === opaque(etag));
}
