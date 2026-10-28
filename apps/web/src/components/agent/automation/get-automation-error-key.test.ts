import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { getAutomationErrorKey } from "./get-automation-error-key";

const error = (status: number, message: string) =>
  new HttpError(status, JSON.stringify({ message }));

describe("getAutomationErrorKey", () => {
  it("explains why Run now was skipped", () => {
    expect(
      getAutomationErrorKey(error(429, "Automation run skipped: budget")),
    ).toBe("agent:automations.errors.budget");
    expect(
      getAutomationErrorKey(error(429, "Automation run skipped: daily_limit")),
    ).toBe("agent:automations.errors.dailyLimit");
    expect(
      getAutomationErrorKey(error(429, "Automation run skipped: overlap")),
    ).toBe("agent:automations.errors.overlap");
  });

  it("maps automation-specific conflicts and limits", () => {
    expect(getAutomationErrorKey(error(429, "Automation limit reached"))).toBe(
      "agent:automations.errors.limit",
    );
    expect(
      getAutomationErrorKey(
        error(409, "Enable the automation before running it"),
      ),
    ).toBe("agent:automations.errors.disabled");
    expect(getAutomationErrorKey(error(409, "Automation owner changed"))).toBe(
      "agent:automations.errors.ownerChanged",
    );
    expect(
      getAutomationErrorKey(
        error(400, "Model is not available on this instance"),
      ),
    ).toBe("agent:automations.errors.model");
  });

  it("falls back to the agent's error copy", () => {
    expect(getAutomationErrorKey(error(429, "Too many runs"))).toBe(
      "agent:errors.rateLimited",
    );
    expect(getAutomationErrorKey(error(403, "Forbidden"))).toBe(
      "agent:errors.forbidden",
    );
    expect(getAutomationErrorKey(new Error("offline"))).toBe(
      "agent:errors.generic",
    );
  });
});
