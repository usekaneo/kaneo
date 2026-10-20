export const BLOCKED_DESTINATION_CODE = "EIMPORTDESTINATION";

const MAX_CAUSE_DEPTH = 5;

export function blockedDestinationError() {
  return Object.assign(
    new Error("Import destination resolves to a non-routable address"),
    { code: BLOCKED_DESTINATION_CODE },
  );
}

export function isBlockedDestinationError(error: unknown) {
  let current = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if ((current as { code?: unknown }).code === BLOCKED_DESTINATION_CODE) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
