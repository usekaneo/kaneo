export const COLOR_PALETTES = ["kaneo", "modern"] as const;

export type ColorPalette = (typeof COLOR_PALETTES)[number];

export function isColorPalette(value: unknown): value is ColorPalette {
  return COLOR_PALETTES.some((palette) => palette === value);
}

export function normalizePalette(value: unknown): ColorPalette {
  return isColorPalette(value) ? value : "kaneo";
}
