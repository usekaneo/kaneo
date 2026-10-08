import { resolveApiBaseUrl } from "@kaneo/libs";

export function apiBaseUrl(): string {
  return resolveApiBaseUrl(import.meta.env.VITE_API_URL);
}

export function joinApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");
  return suffix ? `${base}/${suffix}` : base;
}

export function toPluginAssetUrl(baseUrl: string, path: string): string {
  return /^https?:\/\//i.test(path) ? path : joinApiUrl(baseUrl, path);
}
