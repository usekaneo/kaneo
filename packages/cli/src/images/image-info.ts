export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "svg" | "unknown";

export type ImageInfo = {
  readonly format: ImageFormat;
  readonly width: number;
  readonly height: number;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function be16(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function be32(bytes: Uint8Array, at: number): number {
  return (be16(bytes, at) * 0x10000 + be16(bytes, at + 2)) >>> 0;
}

function le16(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

function le24(bytes: Uint8Array, at: number): number {
  return le16(bytes, at) | ((bytes[at + 2] ?? 0) << 16);
}

function info(format: ImageFormat, width = 0, height = 0): ImageInfo {
  return { format, width, height };
}

function pngInfo(bytes: Uint8Array): ImageInfo | null {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;
  return info("png", be32(bytes, 16), be32(bytes, 20));
}

function isStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 3 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
      continue;
    }
    if (isStartOfFrame(marker)) {
      return info("jpeg", be16(bytes, at + 7), be16(bytes, at + 5));
    }
    at += 2 + be16(bytes, at + 2);
  }
  return info("jpeg");
}

function gifInfo(bytes: Uint8Array): ImageInfo | null {
  const signature = ascii(bytes, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return info("gif", le16(bytes, 6), le16(bytes, 8));
}

function webpInfo(bytes: Uint8Array): ImageInfo | null {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") {
    return info("webp", le16(bytes, 26) & 0x3fff, le16(bytes, 28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    const b0 = bytes[21] ?? 0;
    const b1 = bytes[22] ?? 0;
    const b2 = bytes[23] ?? 0;
    const b3 = bytes[24] ?? 0;
    return info(
      "webp",
      1 + (b0 | ((b1 & 0x3f) << 8)),
      1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)),
    );
  }
  if (chunk === "VP8X") {
    return info("webp", 1 + le24(bytes, 24), 1 + le24(bytes, 27));
  }
  return info("webp");
}

function svgInfo(bytes: Uint8Array): ImageInfo | null {
  const head = new TextDecoder()
    .decode(bytes.subarray(0, 1024))
    .replace(/^﻿/u, "")
    .trimStart();
  if (/^<svg[\s>]/iu.test(head)) return info("svg");
  if (/^<\?xml/iu.test(head) && /<svg[\s>]/iu.test(head)) return info("svg");
  return null;
}

export function imageInfo(bytes: Uint8Array): ImageInfo {
  return (
    pngInfo(bytes) ??
    jpegInfo(bytes) ??
    gifInfo(bytes) ??
    webpInfo(bytes) ??
    svgInfo(bytes) ??
    info("unknown")
  );
}

export const FORMAT_LABELS: Readonly<Record<ImageFormat, string>> = {
  png: "PNG",
  jpeg: "JPEG",
  gif: "GIF",
  webp: "WebP",
  svg: "SVG",
  unknown: "this format",
};
