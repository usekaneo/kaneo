import { errorCodeForStatus } from "./error-code";

const FALLBACK_MESSAGE = "Too many requests";

type Body = { message?: unknown; code?: unknown };

function parseBody(text: string): Body | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Body)
      : null;
  } catch {
    return null;
  }
}

export async function withJsonRateLimit(response: Response): Promise<Response> {
  if (response.status !== 429) return response;
  const text = await response.clone().text();
  const body = parseBody(text);
  if (typeof body?.message === "string" && typeof body.code === "string") {
    return response;
  }
  const message =
    typeof body?.message === "string" ? body.message : body ? "" : text.trim();
  const headers = new Headers(response.headers);
  headers.delete("content-type");
  headers.delete("content-length");
  return Response.json(
    { message: message || FALLBACK_MESSAGE, code: errorCodeForStatus(429) },
    { status: 429, headers },
  );
}
