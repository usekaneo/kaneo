import { SourceHttpError } from "../http.js";

export const TOKEN_REJECTED =
  "Trello rejected the token. Authorize Kaneo on Trello again and paste the new token.";

export const KEY_REJECTED = "Trello rejected the API key.";

export function describeAuthFailure(error: unknown): string | undefined {
  if (!(error instanceof SourceHttpError)) return undefined;
  if (error.status !== 400 && error.status !== 401) return undefined;

  const text = bodyText(error.body);
  if (/invalid key/i.test(text)) return KEY_REJECTED;
  if (error.status === 401 || /token/i.test(text)) return TOKEN_REJECTED;
  return undefined;
}

function bodyText(body: unknown): string {
  if (typeof body === "string") return body;
  if (body == null) return "";
  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}
