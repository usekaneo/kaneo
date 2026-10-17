import type { Rgb } from "./rgba.js";

const CUBE = [0, 95, 135, 175, 215, 255];

function nearestCubeIndex(value: number): number {
  let best = 0;
  for (let index = 1; index < CUBE.length; index++) {
    if (
      Math.abs((CUBE[index] ?? 0) - value) < Math.abs((CUBE[best] ?? 0) - value)
    ) {
      best = index;
    }
  }
  return best;
}

function distance(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

export function nearest256(rgb: Rgb): number {
  const [r, g, b] = rgb.map(nearestCubeIndex) as [number, number, number];
  const cube: Rgb = [CUBE[r] ?? 0, CUBE[g] ?? 0, CUBE[b] ?? 0];
  const average = (rgb[0] + rgb[1] + rgb[2]) / 3;
  const step = Math.max(0, Math.min(23, Math.round((average - 8) / 10)));
  const level = 8 + step * 10;
  const gray: Rgb = [level, level, level];
  return distance(rgb, gray) < distance(rgb, cube)
    ? 232 + step
    : 16 + 36 * r + 6 * g + b;
}

export function colorParameters(
  layer: "foreground" | "background",
  rgb: Rgb,
  level: 2 | 3,
): string {
  const base = layer === "foreground" ? 38 : 48;
  return level === 3
    ? `${base};2;${rgb[0]};${rgb[1]};${rgb[2]}`
    : `${base};5;${nearest256(rgb)}`;
}
