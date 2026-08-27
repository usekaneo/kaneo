import { describe, expect, it } from "vitest";
import {
  isOutboundStateEcho,
  OUTBOUND_STATE_ECHO_WINDOW_MS,
  parseIssueUpdatedAtMs,
} from "../../../../../apps/api/src/plugins/github/utils/outbound-echo";

describe("parseIssueUpdatedAtMs", () => {
  it("parses an ISO timestamp", () => {
    expect(parseIssueUpdatedAtMs({ updated_at: "2026-01-01T00:00:00Z" })).toBe(
      Date.parse("2026-01-01T00:00:00Z"),
    );
  });

  it("returns null for missing or invalid input", () => {
    expect(parseIssueUpdatedAtMs({})).toBeNull();
    expect(parseIssueUpdatedAtMs({ updated_at: "not-a-date" })).toBeNull();
  });
});

describe("isOutboundStateEcho", () => {
  const stamp = Date.parse("2026-01-01T00:00:00Z");

  it("is an echo when the event lands within the window of our write", () => {
    const withinMs = stamp + OUTBOUND_STATE_ECHO_WINDOW_MS - 1;
    expect(
      isOutboundStateEcho(
        { lastOutboundStateSyncAt: stamp },
        { updated_at: new Date(withinMs).toISOString() },
      ),
    ).toBe(true);
  });

  it("is not an echo when the event is well after our write", () => {
    const afterMs = stamp + OUTBOUND_STATE_ECHO_WINDOW_MS + 60_000;
    expect(
      isOutboundStateEcho(
        { lastOutboundStateSyncAt: stamp },
        { updated_at: new Date(afterMs).toISOString() },
      ),
    ).toBe(false);
  });

  it("is not an echo when we never recorded an outbound write", () => {
    expect(
      isOutboundStateEcho({}, { updated_at: "2026-01-01T00:00:00Z" }),
    ).toBe(false);
    expect(
      isOutboundStateEcho(
        { createdFrom: "kaneo" },
        { updated_at: "2026-01-01T00:00:00Z" },
      ),
    ).toBe(false);
  });

  it("is not an echo when the event has no timestamp to compare", () => {
    expect(isOutboundStateEcho({ lastOutboundStateSyncAt: stamp }, {})).toBe(
      false,
    );
  });
});
