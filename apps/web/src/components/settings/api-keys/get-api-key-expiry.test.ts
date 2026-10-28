import { describe, expect, it } from "vite-plus/test";
import { getApiKeyExpiry } from "./get-api-key-expiry";

const now = new Date("2026-10-12T12:00:00Z").getTime();

describe("getApiKeyExpiry", () => {
  it("treats a missing expiry as never expiring", () => {
    expect(getApiKeyExpiry(null, now)).toEqual({ status: "never" });
    expect(getApiKeyExpiry(undefined, now)).toEqual({ status: "never" });
  });

  it("marks future dates as active", () => {
    expect(getApiKeyExpiry("2026-11-01T00:00:00Z", now)).toEqual({
      status: "active",
      date: new Date("2026-11-01T00:00:00Z"),
    });
  });

  it("marks past dates and the current instant as expired", () => {
    expect(getApiKeyExpiry(new Date("2026-09-03T00:00:00Z"), now).status).toBe(
      "expired",
    );
    expect(getApiKeyExpiry(new Date(now), now).status).toBe("expired");
  });
});
