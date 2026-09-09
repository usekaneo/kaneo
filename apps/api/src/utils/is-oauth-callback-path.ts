export function isOAuthCallbackPath(path: unknown): boolean {
  if (typeof path !== "string") return false;
  return path.startsWith("/callback/") || path.startsWith("/oauth2/callback/");
}
