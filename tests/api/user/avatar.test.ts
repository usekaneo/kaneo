import { describe, expect, it } from "vitest";
import {
  buildAvatarUrl,
  decodeAvatarUpload,
  MAX_AVATAR_BYTES,
  normalizeAvatarMimeType,
} from "../../../apps/api/src/user/avatar";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function encode(bytes: number[]) {
  return Buffer.from(bytes).toString("base64");
}

function pngOfSize(size: number) {
  const bytes = Buffer.alloc(size);
  Buffer.from(PNG_HEADER).copy(bytes);
  return bytes.toString("base64");
}

describe("decodeAvatarUpload", () => {
  it("accepts a PNG upload", () => {
    const result = decodeAvatarUpload({
      contentType: "image/png",
      data: encode([...PNG_HEADER, 1, 2, 3]),
    });

    expect(result.mimeType).toBe("image/png");
    expect(result.bytes.length).toBe(11);
  });

  it("accepts a JPEG upload", () => {
    const result = decodeAvatarUpload({
      contentType: "image/jpeg",
      data: encode([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    });

    expect(result.mimeType).toBe("image/jpeg");
  });

  it("accepts a WebP upload", () => {
    const riff = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
      Buffer.from([0x00]),
    ]);

    const result = decodeAvatarUpload({
      contentType: "image/webp",
      data: riff.toString("base64"),
    });

    expect(result.mimeType).toBe("image/webp");
  });

  it("normalizes image/jpg to image/jpeg", () => {
    expect(normalizeAvatarMimeType("IMAGE/JPG")).toBe("image/jpeg");

    const result = decodeAvatarUpload({
      contentType: "image/jpg",
      data: encode([0xff, 0xd8, 0xff, 0x00]),
    });

    expect(result.mimeType).toBe("image/jpeg");
  });

  it("strips a data URL prefix", () => {
    const result = decodeAvatarUpload({
      contentType: "image/png",
      data: `data:image/png;base64,${encode(PNG_HEADER)}`,
    });

    expect(result.bytes.length).toBe(8);
  });

  it("rejects an unsupported image type", () => {
    expect(() =>
      decodeAvatarUpload({
        contentType: "image/svg+xml",
        data: encode(PNG_HEADER),
      }),
    ).toThrow(/Unsupported image type/);
  });

  it("rejects data that is not valid base64", () => {
    expect(() =>
      decodeAvatarUpload({ contentType: "image/png", data: "not base64!!" }),
    ).toThrow(/base64/);
  });

  it("rejects empty data", () => {
    expect(() =>
      decodeAvatarUpload({ contentType: "image/png", data: "" }),
    ).toThrow(/base64/);
  });

  it("rejects uploads above the size limit", () => {
    expect(() =>
      decodeAvatarUpload({
        contentType: "image/png",
        data: pngOfSize(MAX_AVATAR_BYTES + 1),
      }),
    ).toThrow(/maximum avatar size/);
  });

  it("rejects bytes that do not match the declared type", () => {
    expect(() =>
      decodeAvatarUpload({
        contentType: "image/png",
        data: Buffer.from("<html>hello</html>").toString("base64"),
      }),
    ).toThrow(/does not match the declared/);
  });
});

describe("buildAvatarUrl", () => {
  it("builds an API-relative URL", () => {
    expect(buildAvatarUrl("abc123")).toBe("/api/user/avatar/abc123");
  });
});
