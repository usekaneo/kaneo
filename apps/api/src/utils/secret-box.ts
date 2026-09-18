import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { HTTPException } from "hono/http-exception";

// AES-256-GCM for credentials Kaneo has to store and read back (storage
// keys). The key comes from KANEO_SECRET_ENCRYPTION_KEY, falling back to the
// keys an instance already has so existing deployments need no new setting.
const PREFIX = "enc:v1:";

function key() {
  const raw =
    process.env.KANEO_SECRET_ENCRYPTION_KEY?.trim() ||
    process.env.NOTIFICATION_SECRET_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!raw) {
    throw new HTTPException(500, {
      message:
        "Set KANEO_SECRET_ENCRYPTION_KEY (or AUTH_SECRET) to store credentials",
    });
  }
  return createHash("sha256").update(raw).digest();
}

export function sealSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${[iv, tag, encrypted].map((b) => b.toString("base64url")).join(".")}`;
}

export function openSecret(value: string) {
  if (!value.startsWith(PREFIX)) {
    throw new HTTPException(500, {
      message: "Stored credential is not sealed",
    });
  }
  const [iv, tag, encrypted] = value
    .slice(PREFIX.length)
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) {
    throw new HTTPException(500, { message: "Stored credential is damaged" });
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new HTTPException(500, {
      message:
        "Stored credential can't be read; was the encryption key changed?",
    });
  }
}
