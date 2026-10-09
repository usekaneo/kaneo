import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export type PaletteColor = {
  readonly key: string;
  readonly name: string;
  readonly hex: string;
};

export const LABEL_PALETTE: ReadonlyArray<PaletteColor> = [
  { key: "gray", name: "Stone", hex: "#79716b" },
  { key: "dark-gray", name: "Slate", hex: "#62748e" },
  { key: "purple", name: "Lavender", hex: "#8e51ff" },
  { key: "teal", name: "Sage", hex: "#009966" },
  { key: "green", name: "Forest", hex: "#00a63e" },
  { key: "yellow", name: "Amber", hex: "#e17100" },
  { key: "orange", name: "Terracotta", hex: "#f54900" },
  { key: "pink", name: "Rose", hex: "#ec003f" },
  { key: "red", name: "Crimson", hex: "#e7000b" },
];

export const FALLBACK_LABEL_HEX = "#a1a1a1";

const HEX = /^#?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

function findPalette(value: string): PaletteColor | undefined {
  const wanted = value.trim().toLowerCase();
  return LABEL_PALETTE.find(
    (color) => color.key === wanted || color.name.toLowerCase() === wanted,
  );
}

function expandHex(digits: string): string {
  const short = digits.length <= 4;
  const rgb = short
    ? digits
        .slice(0, 3)
        .split("")
        .map((digit) => digit + digit)
        .join("")
    : digits.slice(0, 6);
  return `#${rgb.toLowerCase()}`;
}

export function labelColorHex(color: string): string {
  const palette = findPalette(color);
  if (palette) return palette.hex;
  const match = HEX.exec(color.trim());
  return match?.[1] ? expandHex(match[1]) : FALLBACK_LABEL_HEX;
}

export function labelColorName(color: string): string | null {
  return findPalette(color)?.name.toLowerCase() ?? null;
}

const COLOR_INPUT = /^#?([\da-f]{3}|[\da-f]{6})$/i;

export function parseLabelColor(
  input: string,
): Result.Result<string, InvalidArgument> {
  const palette = findPalette(input);
  if (palette) return Result.succeed(palette.key);
  const match = COLOR_INPUT.exec(input.trim());
  if (match?.[1]) return Result.succeed(expandHex(match[1]));
  return Result.fail(
    new InvalidArgument({
      message: `"${input}" is not a label color.`,
      hint: `Use a hex color such as #e7000b, or one of ${LABEL_PALETTE.map((color) => color.name.toLowerCase()).join(", ")}.`,
    }),
  );
}

function hash(value: string): number {
  let result = 0;
  for (const char of value.normalize("NFKC").toLowerCase()) {
    result = (result * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return result;
}

export function defaultLabelColor(
  name: string,
  usedColors: ReadonlyArray<string>,
): string {
  const used = new Set(usedColors.map((color) => labelColorHex(color)));
  const unused = LABEL_PALETTE.filter((color) => !used.has(color.hex));
  const pool = unused.length > 0 ? unused : LABEL_PALETTE;
  return pool[hash(name) % pool.length]?.key ?? "gray";
}
