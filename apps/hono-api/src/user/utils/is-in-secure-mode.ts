import type { Context } from "hono";

export default function isInSecureMode(request: Context["req"]) {
  return request.header("x-forwarded-proto") === "https";
}
