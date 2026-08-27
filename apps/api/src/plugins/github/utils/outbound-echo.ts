/**
 * Loop guard for two-way issue-state sync.
 *
 * When Kaneo closes/reopens a GitHub issue in response to a task status change,
 * GitHub emits an `issues.closed`/`issues.reopened` webhook that echoes our own
 * write back to us. We stamp `lastOutboundStateSyncAt` on the issue link at the
 * moment of the outbound API call; an inbound webhook whose `updated_at` lands
 * within this window is treated as that echo and skipped, so the task→issue and
 * issue→task directions can both be enabled without bouncing. Mirrors the
 * GitLab plugin's approach.
 */
export const OUTBOUND_STATE_ECHO_WINDOW_MS = 5000;

export function parseIssueUpdatedAtMs(issue: {
  updated_at?: string;
}): number | null {
  const raw = issue.updated_at;
  if (!raw || typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/** True when an inbound issue event looks like the echo of our own write. */
export function isOutboundStateEcho(
  metadata: Record<string, unknown>,
  issue: { updated_at?: string },
): boolean {
  const lastOutbound = metadata.lastOutboundStateSyncAt;
  if (typeof lastOutbound !== "number" || !Number.isFinite(lastOutbound)) {
    return false;
  }
  const eventMs = parseIssueUpdatedAtMs(issue);
  if (eventMs === null) {
    return false;
  }
  return Math.abs(eventMs - lastOutbound) <= OUTBOUND_STATE_ECHO_WINDOW_MS;
}
