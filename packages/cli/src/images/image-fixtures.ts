import { encode } from "jpeg-js";
import { PNG } from "pngjs";

export function pngBytes(
  width: number,
  height: number,
  rgba: ReadonlyArray<number>,
): Uint8Array<ArrayBuffer> {
  const png = new PNG({ width, height });
  png.data.set(rgba);
  return new Uint8Array(PNG.sync.write(png));
}

export function jpegBytes(
  width: number,
  height: number,
  rgba: ReadonlyArray<number>,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    encode({ width, height, data: Buffer.from(rgba) }, 95).data,
  );
}

export function solid(
  width: number,
  height: number,
  pixel: readonly [number, number, number, number],
): number[] {
  return Array.from({ length: width * height }, () => pixel).flat();
}
