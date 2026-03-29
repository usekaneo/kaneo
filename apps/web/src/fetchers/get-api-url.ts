export function getApiUrl(path: string) {
  const trimmedBase = (
    import.meta.env.VITE_API_URL || "http://localhost:1337"
  ).replace(/\/+$/, "");
  const apiUrl = trimmedBase.endsWith("/api")
    ? trimmedBase
    : `${trimmedBase}/api`;
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;

  return `${apiUrl}${normalizedPath}`;
}
