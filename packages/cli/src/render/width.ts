const ESC = "\u001b";
const BEL = "\u0007";
const ANSI_PATTERN = new RegExp(
  `${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`,
  "g",
);

const ZERO_WIDTH = /^(?:\p{Mark}|\p{Control}|\p{Format})+$/u;
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u;

const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x20000, 0x3fffd],
];

let segmenter: Intl.Segmenter | undefined;

function graphemes(text: string): Iterable<string> {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

function isWide(codePoint: number): boolean {
  return WIDE_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

function graphemeWidth(grapheme: string): number {
  if (ZERO_WIDTH.test(grapheme)) return 0;
  if (EMOJI.test(grapheme)) return 2;
  const codePoint = grapheme.codePointAt(0) ?? 0;
  return isWide(codePoint) ? 2 : 1;
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

export function stringWidth(text: string): number {
  const plain = stripAnsi(text);
  if (/^[\x20-\x7e]*$/.test(plain)) return plain.length;
  let width = 0;
  for (const grapheme of graphemes(plain)) width += graphemeWidth(grapheme);
  return width;
}

export function truncate(
  text: string,
  maxWidth: number,
  ellipsis: string,
): string {
  if (maxWidth <= 0) return "";
  if (stringWidth(text) <= maxWidth) return text;
  const ellipsisWidth = stringWidth(ellipsis);
  if (maxWidth <= ellipsisWidth) return ellipsis.slice(0, maxWidth);
  const budget = maxWidth - ellipsisWidth;
  let width = 0;
  let result = "";
  for (const grapheme of graphemes(text)) {
    const next = graphemeWidth(grapheme);
    if (width + next > budget) break;
    result += grapheme;
    width += next;
  }
  return `${result.trimEnd()}${ellipsis}`;
}

export function padEnd(text: string, width: number): string {
  const gap = width - stringWidth(text);
  return gap > 0 ? text + " ".repeat(gap) : text;
}

export function padStart(text: string, width: number): string {
  const gap = width - stringWidth(text);
  return gap > 0 ? " ".repeat(gap) + text : text;
}
