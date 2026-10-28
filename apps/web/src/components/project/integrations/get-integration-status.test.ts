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

  it.each(["pending", "error"] as const)(
    "keeps cached configuration when the query is %s",
    (queryStatus) => {
      expect(
        getIntegrationStatus({
          queryStatus,
          hasData: true,
          configured: true,
          isActive: true,
          detail: "acme/web",
        }),
      ).toEqual({ state: "connected", detail: "acme/web" });
      expect(
        getIntegrationStatus({ queryStatus, hasData: true, configured: false }),
      ).toEqual({ state: "disconnected" });
    },
  );

  it("is disconnected until the integration is configured", () => {
    expect(
      getIntegrationStatus({ configured: false, isActive: true, detail: "x" }),
    ).toEqual({ state: "disconnected" });
  });

  it.each([false, null, undefined])(
    "is paused when configured with inactive value %s",
    (isActive) => {
      expect(getIntegrationStatus({ configured: true, isActive }).state).toBe(
        "paused",
      );
    },
  );

  it("is connected when configured and explicitly active", () => {
    expect(
      getIntegrationStatus({
        configured: true,
        isActive: true,
        detail: " acme/web ",
      }),
    ).toEqual({ state: "connected", detail: "acme/web" });
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
