export function getApiUrl(path: string) {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:1337";
  const apiUrl = baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;

  return `${apiUrl}${path}`;
}
