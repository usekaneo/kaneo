const schemePattern = /^([a-z][a-z0-9+.-]*:\/\/|(mailto|tel):)/i;

// Typed links without a scheme are treated as web addresses; links that
// already name one (https://, obsidian://, mailto:, ...) are kept as typed.
export function normalizeLinkUrl(input: string) {
  const url = input.trim();
  return schemePattern.test(url) ? url : `https://${url}`;
}

export function isWebUrl(url: string) {
  return /^https?:\/\//i.test(url);
}
