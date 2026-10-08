export function pluginPathRest(pathname: string): string[] | null {
  const parts = pathname.split("/");
  const index = parts.indexOf("plugins");
  return index === -1 || parts.length < index + 2
    ? null
    : parts.slice(index + 2);
}
