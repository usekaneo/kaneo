import type { Environment } from "../render/capabilities.js";
import type { Rgb } from "./rgba.js";

const PALETTE: ReadonlyArray<Rgb> = [
  [0, 0, 0],
  [205, 0, 0],
  [0, 205, 0],
  [205, 205, 0],
  [0, 0, 238],
  [205, 0, 205],
  [0, 205, 205],
  [229, 229, 229],
  [127, 127, 127],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [92, 92, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];

export function terminalBackground(env: Environment): Rgb | null {
  const parts = env.COLORFGBG?.split(";") ?? [];
  const last = parts[parts.length - 1]?.trim() ?? "";
  if (!/^\d{1,2}$/u.test(last)) return null;
  return PALETTE[Number(last)] ?? null;
}
