const SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;

export function shellQuote(value: string): string {
  if (SAFE.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
