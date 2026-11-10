import { brandText } from "@kaneo/branding";
export function trelloAuthorizeUrl(apiKey: string): string {
  const params = new URLSearchParams({
    expiration: "1day",
    scope: "read",
    response_type: "token",
    name: brandText("Kaneo"),
    key: apiKey.trim(),
  });
  return `https://trello.com/1/authorize?${params.toString()}`;
}
