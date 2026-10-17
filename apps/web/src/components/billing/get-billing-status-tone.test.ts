import { describe, expect, it } from "vite-plus/test";
import { getBillingStatusTone } from "./get-billing-status-tone";

describe("getBillingStatusTone", () => {
  it("maps billing statuses to badge tones", () => {
    expect(getBillingStatusTone("active")).toBe("success");
    expect(getBillingStatusTone("trialing")).toBe("success");
    expect(getBillingStatusTone("past_due")).toBe("warning");
    expect(getBillingStatusTone("scheduled_cancel")).toBe("warning");
    expect(getBillingStatusTone("canceled")).toBe("destructive");
    expect(getBillingStatusTone("expired")).toBe("destructive");
    expect(getBillingStatusTone("paused")).toBe("neutral");
  });

  it("falls back to neutral for unknown statuses", () => {
    expect(getBillingStatusTone("something-new")).toBe("neutral");
  });
});
