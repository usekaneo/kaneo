const NUMBER = "(?:0|[1-9]\\d*)";
const WILDCARD = "[xX*]";
const IDENTIFIERS = "[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*";
const QUALIFIER = `(?:-${IDENTIFIERS})?(?:\\+${IDENTIFIERS})?`;
const WILDCARDS = `${WILDCARD}(?:\\.${WILDCARD}(?:\\.${WILDCARD})?)?`;
const VERSION = `${NUMBER}(?:\\.${NUMBER}(?:\\.${NUMBER}${QUALIFIER}|\\.${WILDCARD})?|\\.${WILDCARDS})?`;
const PARTIAL = `v?(?:${VERSION}|${WILDCARDS})`;
const OPERATOR = "(?:<=|>=|<|>|=|~>|~|\\^)";

const COMPARATOR = new RegExp(`^${OPERATOR}?${PARTIAL}$`);
const HYPHEN_RANGE = new RegExp(`^${PARTIAL}\\s+-\\s+${PARTIAL}$`);
const OPERATOR_SPACE = new RegExp(`(${OPERATOR})\\s+`, "g");
const MAX_LENGTH = 256;

function isValidSet(set) {
  const trimmed = set.trim();
  if (!trimmed) return false;
  if (HYPHEN_RANGE.test(trimmed)) return true;
  return trimmed
    .replace(OPERATOR_SPACE, "$1")
    .split(/\s+/)
    .every((comparator) => COMPARATOR.test(comparator));
}

export function isValidRange(range) {
  if (typeof range !== "string" || range.length > MAX_LENGTH) return false;
  if (!range.trim()) return false;
  return range.split("||").every(isValidSet);
}
