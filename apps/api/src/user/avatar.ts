export const MAX_AVATAR_BYTES = 512 * 1024;

const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export function isAvatarMimeType(value: string): value is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(value);
}

export function normalizeAvatarMimeType(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function hasMagicBytes(mimeType: AvatarMimeType, bytes: Buffer) {
  switch (mimeType) {
    case "image/png":
      return (
        bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(
          // biome-ignore format: PNG signature
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )
      );
    case "image/jpeg":
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
  }
}

export function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:[^;,]*;base64,/, "");
}

export function decodeAvatarUpload(input: {
  contentType: string;
  data: string;
}): { mimeType: AvatarMimeType; bytes: Buffer } {
  const mimeType = normalizeAvatarMimeType(input.contentType);

  if (!isAvatarMimeType(mimeType)) {
    throw new Error(
      "Unsupported image type. Upload a PNG, JPEG, or WebP image.",
    );
  }

  const payload = stripDataUrlPrefix(input.data).replace(/\s+/g, "");

  if (!payload || !BASE64_PATTERN.test(payload) || payload.length % 4 !== 0) {
    throw new Error("Image data must be base64 encoded.");
  }

  const bytes = Buffer.from(payload, "base64");

  if (bytes.length === 0) {
    throw new Error("Image data must not be empty.");
  }

  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new Error(
      `Image exceeds the maximum avatar size of ${Math.floor(MAX_AVATAR_BYTES / 1024)}KB.`,
    );
  }

  if (!hasMagicBytes(mimeType, bytes)) {
    throw new Error(`Image data does not match the declared ${mimeType} type.`);
  }

  return { mimeType, bytes };
}

export function buildAvatarUrl(avatarId: string) {
  return `/api/user/avatar/${avatarId}`;
}
