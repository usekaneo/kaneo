import { describe, expect, it } from "vite-plus/test";
import { canDecode, decodeImage } from "./decode-image.js";
import { jpegBytes, pngBytes, solid } from "./image-fixtures.js";
import { imageInfo } from "./image-info.js";

describe("decodeImage", () => {
  it("decodes PNG pixels, alpha included", async () => {
    const bytes = pngBytes(2, 1, [255, 0, 0, 255, 0, 0, 255, 0]);
    const image = await decodeImage(bytes, imageInfo(bytes));
    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
    expect([...image.data]).toEqual([255, 0, 0, 255, 0, 0, 255, 0]);
  });

  it("decodes JPEG pixels to RGBA", async () => {
    const bytes = jpegBytes(8, 8, solid(8, 8, [0, 200, 0, 255]));
    const image = await decodeImage(bytes, imageInfo(bytes));
    expect(image.width).toBe(8);
    expect(image.data.length).toBe(8 * 8 * 4);
    const [r = 0, g = 0, b = 0, a = 0] = image.data;
    expect(Math.abs(r - 0)).toBeLessThan(8);
    expect(Math.abs(g - 200)).toBeLessThan(8);
    expect(Math.abs(b - 0)).toBeLessThan(8);
    expect(a).toBe(255);
  });

  it("refuses formats it cannot decode and huge images", async () => {
    expect(canDecode({ format: "gif", width: 1, height: 1 })).toBe(false);
    expect(canDecode({ format: "png", width: 10_000, height: 10_000 })).toBe(
      false,
    );
    await expect(
      decodeImage(new Uint8Array([1]), { format: "webp", width: 1, height: 1 }),
    ).rejects.toThrow();
  });
});
