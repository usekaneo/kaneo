import { describe, expect, it } from "vite-plus/test";
import { getCodeJobLabel } from "./get-code-job-label";

const job = { outcome: null, prNumber: null } as const;

describe("getCodeJobLabel", () => {
  it("labels each active state", () => {
    for (const status of [
      "queued",
      "dispatched",
      "running",
      "committing",
    ] as const)
      expect(getCodeJobLabel({ ...job, status })).toEqual({
        key: `agent:code.status.${status}`,
        tone: "active",
      });
  });

  it("names the opened pull request", () => {
    expect(
      getCodeJobLabel({
        status: "completed",
        outcome: "pr_opened",
        prNumber: 1874,
      }),
    ).toEqual({
      key: "agent:code.status.prOpened",
      values: { number: 1874 },
      tone: "success",
    });
  });

  it("labels terminal outcomes without a pull request", () => {
    expect(
      getCodeJobLabel({ ...job, status: "completed", outcome: "no_changes" })
        .key,
    ).toBe("agent:code.status.noChanges");
    expect(getCodeJobLabel({ ...job, status: "failed" })).toMatchObject({
      key: "agent:code.status.failed",
      tone: "danger",
    });
    expect(getCodeJobLabel({ ...job, status: "cancelled" }).key).toBe(
      "agent:code.status.cancelled",
    );
  });
});
