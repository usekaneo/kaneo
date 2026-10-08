export const MAX_BUSY_WAIT_SECONDS = 60;

export type DeletionOutcome =
  | { readonly kind: "deleted" }
  | { readonly kind: "pending" }
  | { readonly kind: "busy"; readonly retryAfterSeconds: number | null };

export type DeletionStep =
  | { readonly kind: "done" }
  | { readonly kind: "repeat" }
  | { readonly kind: "wait"; readonly seconds: number }
  | { readonly kind: "give-up" };

export function nextDeletionStep(
  outcome: DeletionOutcome,
  waitedSeconds: number,
  maxWaitSeconds = MAX_BUSY_WAIT_SECONDS,
): DeletionStep {
  if (outcome.kind === "deleted") return { kind: "done" };
  if (outcome.kind === "pending") return { kind: "repeat" };
  const seconds = Math.max(1, outcome.retryAfterSeconds ?? 1);
  const remaining = maxWaitSeconds - waitedSeconds;
  if (remaining <= 0) return { kind: "give-up" };
  return { kind: "wait", seconds: Math.min(seconds, remaining) };
}
