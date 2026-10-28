import { randomBytes } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { encryptSecret } from "../../notification-preferences/secrets";

export function newSigningSecret() {
  if (!process.env.NOTIFICATION_SECRET_ENCRYPTION_KEY?.trim()) {
    throw new HTTPException(409, {
      message:
        "Set NOTIFICATION_SECRET_ENCRYPTION_KEY to create or rotate webhook secrets.",
    });
  }
  const secret = randomBytes(32).toString("base64url");
  return { secret, encrypted: encryptSecret(secret)! };
}
