import type { ImageInfo } from "./image-info.js";
import type { RgbaImage } from "./rgba.js";

export const MAX_DECODE_PIXELS = 40_000_000;

export const MAX_PASSTHROUGH_PIXELS = 4096 * 4096;

function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

async function decodePng(bytes: Uint8Array): Promise<RgbaImage> {
  const { PNG } = await import("pngjs");
  const png = PNG.sync.read(asBuffer(bytes));
  return {
    width: png.width,
    height: png.height,
    data: new Uint8Array(
      png.data.buffer,
      png.data.byteOffset,
      png.data.byteLength,
    ),
  };
}

async function decodeJpeg(bytes: Uint8Array): Promise<RgbaImage> {
  const { decode } = await import("jpeg-js");
  const jpeg = decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: MAX_DECODE_PIXELS / 1_000_000,
    maxMemoryUsageInMB: 512,
  });
  return { width: jpeg.width, height: jpeg.height, data: jpeg.data };
}

export function canDecode(info: ImageInfo): boolean {
  return (
    (info.format === "png" || info.format === "jpeg") &&
    info.width > 0 &&
    info.height > 0 &&
    info.width * info.height <= MAX_DECODE_PIXELS
  );
}

export async function decodeImage(
  bytes: Uint8Array,
  info: ImageInfo,
): Promise<RgbaImage> {
  if (!canDecode(info)) throw new Error(`cannot decode ${info.format}`);
  return info.format === "png" ? decodePng(bytes) : decodeJpeg(bytes);
}
