import { HTTPException } from "hono/http-exception";
import { assertPublicDestination } from "../../utils/assert-public-destination";

export async function validateWebhookUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new HTTPException(400, {
      message: "Use an HTTPS URL without credentials or a fragment.",
    });
  }
  try {
    await assertPublicDestination(value, "Webhook");
  } catch {
    throw new HTTPException(400, {
      message: "Webhook URL must resolve to a public address.",
    });
  }
  return url.href;
}
