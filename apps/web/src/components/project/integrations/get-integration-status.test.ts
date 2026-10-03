import { describe, expect, it } from "vite-plus/test";
import {
  formatChannel,
  formatRepository,
  getIntegrationStatus,
} from "@/components/project/integrations/get-integration-status";

describe("getIntegrationStatus", () => {
  it("does not report pending or failed requests as disconnected", () => {
    expect(
      getIntegrationStatus({ queryStatus: "pending", configured: false }),
    ).toEqual({ state: "loading" });
    expect(
      getIntegrationStatus({ queryStatus: "error", configured: false }),
    ).toEqual({ state: "unavailable" });
    expect(
      getIntegrationStatus({
        queryStatus: "error",
        configured: true,
        detail: "stale",
      }),
    ).toEqual({ state: "unavailable" });
  });

  it("is disconnected until the integration is configured", () => {
    expect(
      getIntegrationStatus({ configured: false, isActive: true, detail: "x" }),
    ).toEqual({ state: "disconnected" });
  });

  it("is paused when configured but switched off", () => {
    expect(
      getIntegrationStatus({ configured: true, isActive: false }).state,
    ).toBe("paused");
  });

  it("is connected when configured and not switched off", () => {
    expect(
      getIntegrationStatus({
        configured: true,
        isActive: true,
        detail: " acme/web ",
      }),
    ).toEqual({ state: "connected", detail: "acme/web" });
    expect(getIntegrationStatus({ configured: true }).state).toBe("connected");
  });
});

describe("integration detail formatting", () => {
  it("joins repository owner and name", () => {
    expect(formatRepository("acme", "web")).toBe("acme/web");
    expect(formatRepository("acme", null)).toBeUndefined();
  });

  it("prefixes channels with a single #", () => {
    expect(formatChannel("general")).toBe("#general");
    expect(formatChannel("#general")).toBe("#general");
    expect(formatChannel("  ")).toBeUndefined();
  });
});
