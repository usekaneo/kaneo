const schemePattern = /^[a-z][a-z0-9+.-]*:/i;
// Bare internal names can have ports. Phone and video links can also contain
// just a number after the scheme, so keep those links as typed.
const hostPortPattern = /^([a-z\d-]+(?:\.[a-z\d-]+)*\.?):(\d+)(?=[/?#]|$)/i;
const numericAppSchemes = new Set(["tel", "sms", "facetime", "facetime-audio"]);

function hasHostPort(url: string) {
  const [, host, port] = hostPortPattern.exec(url) ?? [];
  return (
    host !== undefined &&
    port !== undefined &&
    !numericAppSchemes.has(host.toLowerCase()) &&
    Number(port) <= 65535
  );
}

// Typed links without a scheme are treated as web addresses; links that
// already name one (https://, obsidian://, mailto:, ...) are kept as typed.
export function normalizeLinkUrl(input: string) {
  const url = input.trim();
  return schemePattern.test(url) && !hasHostPort(url)
    ? url
    : `https://${url}`;
}

export function isWebUrl(url: string) {
  return /^https?:\/\//i.test(url);
}
