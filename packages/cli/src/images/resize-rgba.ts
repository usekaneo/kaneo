import type { RgbaImage } from "./rgba.js";

function spans(
  source: number,
  target: number,
): Array<readonly [number, number]> {
  const scale = source / target;
  return Array.from({ length: target }, (_, index) => {
    const start = Math.min(source - 1, Math.floor(index * scale));
    const end = Math.max(
      start + 1,
      Math.min(source, Math.floor((index + 1) * scale)),
    );
    return [start, end] as const;
  });
}

export function resizeRgba(
  image: RgbaImage,
  width: number,
  height: number,
): RgbaImage {
  const targetWidth = Math.max(1, Math.round(width));
  const targetHeight = Math.max(1, Math.round(height));
  if (targetWidth === image.width && targetHeight === image.height) {
    return image;
  }
  const columns = spans(image.width, targetWidth);
  const rows = spans(image.height, targetHeight);
  const data = new Uint8Array(targetWidth * targetHeight * 4);
  const source = image.data;
  for (let y = 0; y < targetHeight; y++) {
    const [top, bottom] = rows[y] ?? [0, 1];
    for (let x = 0; x < targetWidth; x++) {
      const [left, right] = columns[x] ?? [0, 1];
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;
      for (let sy = top; sy < bottom; sy++) {
        let at = (sy * image.width + left) * 4;
        for (let sx = left; sx < right; sx++, at += 4) {
          const a = source[at + 3] ?? 0;
          red += (source[at] ?? 0) * a;
          green += (source[at + 1] ?? 0) * a;
          blue += (source[at + 2] ?? 0) * a;
          alpha += a;
          count += 1;
        }
      }
      const out = (y * targetWidth + x) * 4;
      if (alpha > 0) {
        data[out] = Math.round(red / alpha);
        data[out + 1] = Math.round(green / alpha);
        data[out + 2] = Math.round(blue / alpha);
      }
      data[out + 3] = Math.round(alpha / Math.max(1, count));
    }
  }
  return { width: targetWidth, height: targetHeight, data };
}
