const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

export function normalizeLinkHref(input: string) {
  const value = input.trim();
  if (!value) return "";
  if (HAS_SCHEME.test(value) || /^[/#?]/.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  return `https://${value}`;
}
