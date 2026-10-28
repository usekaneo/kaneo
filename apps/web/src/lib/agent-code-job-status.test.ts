import { expect, it } from "vite-plus/test";
import { isAgentCodeJobActive } from "./agent-code-job-status";
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
