import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { HTTPException } from "hono/http-exception";

const SECRET_PREFIX = "enc:v1:";
const SECRET_ALGORITHM = "aes-256-gcm";
const SECRET_IV_BYTES = 12;

function getSecretEncryptionKey() {
  const rawKey = process.env.NOTIFICATION_SECRET_ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    return null;
  }

  return createHash("sha256").update(rawKey).digest();
}

function requireSecretEncryptionKey() {
  const key = getSecretEncryptionKey();
  if (!key) {
    throw new HTTPException(500, {
      message:
        "NOTIFICATION_SECRET_ENCRYPTION_KEY is required to store encrypted notification secrets",
    });
  }

  return key;
}

function encodePart(value: Buffer) {
  return value.toString("base64url");
}

function decodePart(value: string) {
  return Buffer.from(value, "base64url");
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(SECRET_PREFIX);
}

function isValidEncryptedSecret(value: string): boolean {
  try {
    decryptSecret(value);
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (isEncryptedSecret(value) && isValidEncryptedSecret(value)) {
    return value;
  }

  const iv = randomBytes(SECRET_IV_BYTES);
  const cipher = createCipheriv(
    SECRET_ALGORITHM,
    requireSecretEncryptionKey(),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${SECRET_PREFIX}${encodePart(iv)}.${encodePart(authTag)}.${encodePart(encrypted)}`;
}

export function decryptSecret(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null || !isEncryptedSecret(value)) {
    return value;
  }

  const payload = value.slice(SECRET_PREFIX.length);
  const [iv, authTag, encrypted] = payload.split(".");

  if (!iv || !authTag || !encrypted) {
    throw new HTTPException(500, {
      message: "Invalid encrypted notification secret payload",
    });
  }

  try {
    const decipher = createDecipheriv(
      SECRET_ALGORITHM,
      requireSecretEncryptionKey(),
      decodePart(iv),
    );
    decipher.setAuthTag(decodePart(authTag));

    return Buffer.concat([
      decipher.update(decodePart(encrypted)),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, {
      message: "Failed to decrypt notification secret",
    });
  }
}
