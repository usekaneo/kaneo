import { describe, expect, it } from "vite-plus/test";
import { serviceStatusTone } from "./service-status-tone";

describe("serviceStatusTone", () => {
  it("shows optional, switched-off services as neutral rather than broken", () => {
    expect(serviceStatusTone("not_configured")).toBe("neutral");
  });

  it("maps the remaining statuses to matching tones", () => {
    expect(serviceStatusTone("ok")).toBe("success");
    expect(serviceStatusTone("warning")).toBe("warning");
    expect(serviceStatusTone("down")).toBe("destructive");
  });
});
