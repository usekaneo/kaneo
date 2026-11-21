// Drizzle wraps the PostgreSQL error in its query error's cause.
export function isPendingLabelDeletionError(error: unknown): boolean {
  let cause = error;
  while (cause instanceof Error) {
    if (
      "code" in cause &&
      cause.code === "23514" &&
      "constraint" in cause &&
      cause.constraint === "label_assignment_pending_deletion"
    ) {
      return true;
    }
    cause = cause.cause;
  }
  return false;
}
