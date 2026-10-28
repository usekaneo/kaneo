import { ProbeTimeoutError } from "./with-timeout";

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/**
 * A short identifier for a failed probe. Driver messages can include hosts,
 * user names or credentials, so only well-formed codes and error names are
 * kept; anything else becomes UNKNOWN.
 */
export function safeErrorCode(error: unknown): string {
  if (error instanceof ProbeTimeoutError) return "TIMEOUT";
  if (typeof error !== "object" || error === null) return "UNKNOWN";
  const { code, name } = error as { code?: unknown; name?: unknown };
  if (typeof code === "string" && CODE_PATTERN.test(code)) return code;
  if (typeof name === "string" && name !== "Error" && CODE_PATTERN.test(name)) {
    return name;
  }
  return "UNKNOWN";
}
