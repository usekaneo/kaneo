import { describe, expect, it } from "vite-plus/test";
import { jpegBytes, pngBytes, solid } from "./image-fixtures.js";
import { imageInfo } from "./image-info.js";

function bytes(...parts: ReadonlyArray<string | ArrayLike<number>>) {
  return new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string"
        ? Array.from(part, (character) => character.charCodeAt(0))
        : Array.from(part),
    ),
  );
}

describe("imageInfo", () => {
  it("reads PNG and JPEG dimensions", () => {
    expect(imageInfo(pngBytes(3, 2, solid(3, 2, [1, 2, 3, 255])))).toEqual({
      format: "png",
      width: 3,
      height: 2,
    });
    expect(imageInfo(jpegBytes(17, 9, solid(17, 9, [9, 9, 9, 255])))).toEqual({
      format: "jpeg",
      width: 17,
      height: 9,
    });
  });

  it("reads GIF dimensions", () => {
    expect(imageInfo(bytes("GIF89a", [0x40, 0x01, 0xf0, 0x00]))).toEqual({
      format: "gif",
      width: 320,
      height: 240,
    });
  });

  it("reads lossy, lossless and extended WebP dimensions", () => {
    const header = (chunk: string) =>
      bytes("RIFF", [0, 0, 0, 0], "WEBP", chunk);
    expect(
      imageInfo(
        bytes(
          header("VP8 "),
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0x80, 0x02, 0xe0, 0x01],
        ),
      ),
    ).toEqual({ format: "webp", width: 640, height: 480 });
    expect(
      imageInfo(
        bytes(header("VP8L"), [0, 0, 0, 0, 0x2f], [0x3f, 0xc0, 0x13, 0x00]),
      ),
    ).toEqual({ format: "webp", width: 64, height: 80 });
    expect(
      imageInfo(
        bytes(header("VP8X"), [0, 0, 0, 0, 0, 0, 0, 0], [99, 0, 0, 49, 0, 0]),
      ),
    ).toEqual({ format: "webp", width: 100, height: 50 });
  });

  it("recognises SVG documents", () => {
    expect(
      imageInfo(bytes('<?xml version="1.0"?>\n<svg width="1"/>')).format,
    ).toBe("svg");
    expect(imageInfo(bytes("<svg xmlns='x'></svg>")).format).toBe("svg");
  });

  it("reports anything else as unknown", () => {
    expect(imageInfo(bytes("hello"))).toEqual({
      format: "unknown",
      width: 0,
      height: 0,
    });
  });
});
