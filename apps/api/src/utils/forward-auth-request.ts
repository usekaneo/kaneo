import type { Context } from "hono";
import { auth } from "../auth";
import { withJsonNotFound } from "../errors/not-found-response";
import { withJsonRateLimit } from "../errors/rate-limit-response";
import { apiKeyRejection } from "./api-key-rejection";
import { apiKeyResponseHeaders } from "./rate-limit-headers";
import { readApiKeyCheck, verifyApiKey } from "./verify-api-key";

export async function forwardAuthRequest(c: Context): Promise<Response> {
  c.header("Cache-Control", "no-store");
  const headers = new Headers(c.req.raw.headers);
  const bearerToken = headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const apiKeyHeader = headers.get("x-api-key")?.trim();
  let bearerKey: string | undefined;
  if (bearerToken && !apiKeyHeader) {
    // Explicit bearer credentials never fall back to a browser's cookie.
    // This also applies to the separately registered native get-session route.
    headers.delete("cookie");
    const verified = await verifyApiKey(bearerToken, { consume: false });
    if (verified?.status === "valid") {
      headers.set("x-api-key", bearerToken);
      headers.delete("authorization");
      bearerKey = bearerToken;
    } else if (verified) {
      throw apiKeyRejection(verified);
    } else {
      const session = await auth.api.getSession({ headers });
      if (!session?.session || !session.user) throw apiKeyRejection(null);
    }
  }
  const response = await withJsonRateLimit(
    await withJsonNotFound(
      await auth.handler(new Request(c.req.raw, { headers })),
    ),
  );
  if (bearerKey) {
    c.set(
      "apiKeyHeaders",
      await apiKeyResponseHeaders(
        await readApiKeyCheck(bearerKey),
        response,
        new Date(),
      ),
    );
  }
  return response;
}
