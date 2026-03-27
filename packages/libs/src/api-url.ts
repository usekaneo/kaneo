/**
 * Resolves the Hono client base URL from `VITE_API_URL` (or default).
 * If the value already ends with `/api`, it is returned as-is; otherwise `/api` is appended.
 */
export function resolveApiBaseUrl(viteApiUrl: string | undefined): string {
	const baseUrl = viteApiUrl || "http://localhost:1337";
	return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
}
