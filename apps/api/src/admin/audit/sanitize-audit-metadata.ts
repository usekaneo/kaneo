const SECRET_KEY = /password|secret|token|api_?key|^key$|cookie/i;
const MAX_DEPTH = 4;

/**
 * Callers never pass credentials, but metadata is permanent: drop any key that
 * looks like one so a future mistake cannot write a secret into the log.
 */
export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    return depth >= MAX_DEPTH
      ? []
      : value.map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => !SECRET_KEY.test(key) && item !== undefined)
      .map(([key, item]) => [key, sanitizeAuditMetadata(item, depth + 1)]),
  );
}
