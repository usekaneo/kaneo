import { withoutOutboundTelemetry } from "../utils/sensitive-outbound";
import {
  type AvatarMimeType,
  MAX_AVATAR_BYTES,
  validateAvatarBytes,
} from "./avatar";

export const GOOGLE_AVATAR_FETCH_TIMEOUT_MS = 5_000;
export const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";
const MAX_GOOGLE_USERINFO_BYTES = 16_384;

export function isAllowedGoogleAvatarUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      return false;
    }
    const host = url.hostname.toLowerCase();
    return (
      host === "googleusercontent.com" ||
      host.endsWith(".googleusercontent.com") ||
      host === "ggpht.com" ||
      host.endsWith(".ggpht.com")
    );
  } catch {
    return false;
  }
}

export function extractGooglePictureFromIdToken(
  idToken: string | null | undefined,
): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { picture?: unknown };
    return typeof payload?.picture === "string" && payload.picture.trim()
      ? payload.picture.trim()
      : null;
  } catch {
    return null;
  }
}

async function readBoundedBytes(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength > maxBytes) {
      void response.body?.cancel().catch(() => {});
      throw new Error("Response exceeds maximum allowed size");
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is empty");
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        throw new Error("Response exceeds maximum allowed size");
      }
      chunks.push(value);
    }

    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function fetchGoogleUserInfoPicture(
  accessToken: string,
): Promise<string | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Google userinfo request timed out"));
    }, GOOGLE_AVATAR_FETCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await withoutOutboundTelemetry(() =>
          fetch(GOOGLE_USERINFO_URL, {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            redirect: "error",
            signal: controller.signal,
          }),
        );

        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          return null;
        }

        const bytes = await readBoundedBytes(
          response,
          MAX_GOOGLE_USERINFO_BYTES,
        );
        const data = JSON.parse(bytes.toString("utf8")) as {
          picture?: unknown;
        };
        return typeof data?.picture === "string" && data.picture.trim()
          ? data.picture.trim()
          : null;
      })(),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function fetchGoogleAvatar(
  pictureUrl: string,
): Promise<{ mimeType: AvatarMimeType; bytes: Buffer } | null> {
  const trimmedUrl = pictureUrl.trim();
  if (!isAllowedGoogleAvatarUrl(trimmedUrl)) {
    return null;
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Google avatar fetch timed out"));
    }, GOOGLE_AVATAR_FETCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await withoutOutboundTelemetry(() =>
          fetch(trimmedUrl, {
            headers: {
              Accept: "image/webp,image/png,image/jpeg",
            },
            redirect: "error",
            signal: controller.signal,
          }),
        );

        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          return null;
        }

        const bytes = await readBoundedBytes(response, MAX_AVATAR_BYTES);
        return validateAvatarBytes({
          contentType: response.headers.get("content-type") ?? "",
          bytes,
        });
      })(),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
