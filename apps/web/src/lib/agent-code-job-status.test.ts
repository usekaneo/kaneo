import { expect, it } from "vite-plus/test";
import {
  canCancelAgentCodeJob,
  isAgentCodeJobActive,
} from "./agent-code-job-status";
it("polls only active code job states", () => {
  for (const status of [
    "queued",
    "dispatched",
    "running",
    "committing",
  ] as const)
    expect(isAgentCodeJobActive(status)).toBe(true);
  for (const status of ["completed", "failed", "cancelled"] as const)
    expect(isAgentCodeJobActive(status)).toBe(false);
});

it("allows cancel only before committing", () => {
  for (const status of ["queued", "dispatched", "running"] as const)
    expect(canCancelAgentCodeJob(status)).toBe(true);
  for (const status of [
    "committing",
    "completed",
    "failed",
    "cancelled",
  ] as const)
    expect(canCancelAgentCodeJob(status)).toBe(false);
});
