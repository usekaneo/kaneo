import { describe, expect, it } from "vite-plus/test";
import { contentTypeFor, isInlineImageType } from "./content-type.js";
import { pngBytes, solid } from "./image-fixtures.js";

const text = new TextEncoder().encode("hello");

describe("contentTypeFor", () => {
  it("trusts the bytes over the extension for images", () => {
    expect(
      contentTypeFor("shot.jpg", pngBytes(1, 1, solid(1, 1, [0, 0, 0, 255]))),
    ).toBe("image/png");
  });

  it("falls back to the extension", () => {
    expect(contentTypeFor("notes.PDF", text)).toBe("application/pdf");
    expect(contentTypeFor("logo.svg", text)).toBe("image/svg+xml");
    expect(contentTypeFor("archive.tar.gz", text)).toBe("application/gzip");
    expect(contentTypeFor("README", text)).toBe("application/octet-stream");
  });
});

describe("isInlineImageType", () => {
  it("matches the image types the server shows inline", () => {
    expect(isInlineImageType("image/png")).toBe(true);
    expect(isInlineImageType("IMAGE/WEBP")).toBe(true);
    expect(isInlineImageType("image/svg+xml")).toBe(false);
    expect(isInlineImageType("application/pdf")).toBe(false);
  });
});
