import { resolvePublicEnvVar } from "@kaneo/libs";

export function getApiUrl(path: string) {
  const trimmedBase = (
    resolvePublicEnvVar("VITE_API_URL", import.meta.env.VITE_API_URL) ||
    "http://localhost:1337"
  ).replace(/\/+$/, "");
  const apiUrl = trimmedBase.endsWith("/api")
    ? trimmedBase
    : `${trimmedBase}/api`;
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;

  return `${apiUrl}${normalizedPath}`;
}
