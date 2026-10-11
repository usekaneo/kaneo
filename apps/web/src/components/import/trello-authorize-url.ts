export function trelloAuthorizeUrl(apiKey: string): string | null {
  const key = apiKey.trim();
  if (!key) return null;

  const url = new URL("https://trello.com/1/authorize");
  url.searchParams.set("expiration", "1day");
  url.searchParams.set("scope", "read");
  url.searchParams.set("response_type", "token");
  url.searchParams.set("name", "Kaneo");
  url.searchParams.set("key", key);
  return url.toString();
}
