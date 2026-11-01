import { expect, it } from "vite-plus/test";
import { getCodeJobFailureKey } from "./get-code-job-failure-key";

it("translates known failure codes and falls back for the rest", () => {
  expect(getCodeJobFailureKey("timed_out")).toBe("agent:code.failure.timedOut");
  expect(getCodeJobFailureKey("no_model_key")).toBe(
    "agent:code.failure.noModelKey",
  );
  expect(getCodeJobFailureKey("something_new")).toBe(
    "agent:code.failure.generic",
  );
  expect(getCodeJobFailureKey(null)).toBe("agent:code.failure.generic");
});
