const range = (from: number, to: number) =>
  `${String.fromCharCode(from)}-${String.fromCharCode(to)}`;

const CONTROL = new RegExp(
  `[${range(0, 8)}${range(11, 31)}${range(127, 159)}]`,
  "g",
);

export function sanitizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(CONTROL, "");
}

export function sanitizeDeep(value: unknown): unknown {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeDeep(entry)]),
    );
  }
  return value;
}

const SAFE_URL = /^https?:\/\/[\x21-\x7e]+$/i;

export function isSafeUrl(url: string): boolean {
  return SAFE_URL.test(url);
}
