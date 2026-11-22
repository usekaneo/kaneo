type Oklch = { l: number; c: number; h: number; alpha: number };

const OKLCH =
  /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%?)?\s*\)$/;

export function parseOklch(value: string): Oklch | null {
  const match = value.trim().match(OKLCH);
  if (!match) return null;
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  return {
    l: Number(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
    alpha: alpha > 1 ? alpha / 100 : alpha,
  };
}

/** Linear-light sRGB channels, clamped to the 0–1 gamut. */
function toLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;

  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  return [
    clamp(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    clamp(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    clamp(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  ];
}

function relativeLuminance(value: string): number | null {
  const parsed = parseOklch(value);
  if (!parsed) return null;
  // Compositing a translucent token over its backdrop needs the backdrop, so
  // refuse instead of reporting the unpremultiplied ratio as if it were real.
  if (parsed.alpha !== 1) return null;
  const [r, g, b] = toLinearSrgb(parsed);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number | null {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  if (first === null || second === null) return null;
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
