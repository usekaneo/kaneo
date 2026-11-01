import { expect, it } from "vite-plus/test";
import { getCodeJobPhaseKey } from "./get-code-job-phase-key";

it("translates known phases only", () => {
  expect(getCodeJobPhaseKey("testing")).toBe("agent:code.phase.testing");
  expect(getCodeJobPhaseKey("opening_pr")).toBe("agent:code.phase.openingPr");
  expect(getCodeJobPhaseKey("unexpected")).toBeNull();
  expect(getCodeJobPhaseKey(null)).toBeNull();
});
