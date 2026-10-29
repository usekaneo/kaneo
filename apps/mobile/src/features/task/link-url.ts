const schemePattern = /^[a-z][a-z0-9+.-]*:/i;
// "localhost:3000" and "example.com:8080/docs" start like a scheme but are a
// host and port. Real schemes rarely contain a dot, so "tel:5551234" stays a
// phone link.
const hostPortPattern = /^(localhost|[^:/]*\.[^:/]*):\d+([/?#]|$)/i;

// Typed links without a scheme are treated as web addresses; links that
// already name one (https://, obsidian://, mailto:, ...) are kept as typed.
export function normalizeLinkUrl(input: string) {
  const url = input.trim();
  return schemePattern.test(url) && !hostPortPattern.test(url)
    ? url
    : `https://${url}`;
}

export function isWebUrl(url: string) {
  return /^https?:\/\//i.test(url);
}
