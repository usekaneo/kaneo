import { describe, expect, it } from "vite-plus/test";
import {
  ACTIVE_CODE_JOB_STATUSES,
  canTransition,
  isTerminal,
  statusesBefore,
} from "./lifecycle";

describe("coding job lifecycle", () => {
  it("follows queued → dispatched → running → committing → completed", () => {
    expect(canTransition("queued", "dispatched")).toBe(true);
    expect(canTransition("dispatched", "running")).toBe(true);
    expect(canTransition("running", "committing")).toBe(true);
    expect(canTransition("committing", "completed")).toBe(true);
  });

  it("never skips the claim or reopens a finished job", () => {
    expect(canTransition("queued", "running")).toBe(false);
    expect(canTransition("dispatched", "committing")).toBe(false);
    for (const terminal of ["completed", "failed", "cancelled"] as const) {
      expect(isTerminal(terminal)).toBe(true);
      expect(canTransition(terminal, "queued")).toBe(false);
      expect(canTransition(terminal, "failed")).toBe(false);
    }
  });

  it("finishes a run without changes directly from running", () => {
    expect(canTransition("running", "completed")).toBe(true);
    expect(statusesBefore("completed")).toEqual(["running", "committing"]);
  });

  it("cancels only before Kaneo starts creating the pull request", () => {
    expect(statusesBefore("cancelled")).toEqual([
      "queued",
      "dispatched",
      "running",
    ]);
    expect(canTransition("committing", "cancelled")).toBe(false);
  });

  it("lets every active job fail", () => {
    expect(ACTIVE_CODE_JOB_STATUSES).toEqual([
      "queued",
      "dispatched",
      "running",
      "committing",
    ]);
    for (const status of ACTIVE_CODE_JOB_STATUSES)
      expect(canTransition(status, "failed")).toBe(true);
  });
});
