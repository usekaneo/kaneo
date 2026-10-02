import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { isTrackingEnabled, track } from "./track";

afterEach(() => {
  delete window.plausible;
});

describe("track", () => {
  it("does nothing when Plausible is not loaded, as on self-hosted instances", () => {
    expect(isTrackingEnabled()).toBe(false);
    expect(() => track("Signup")).not.toThrow();
  });

  it("forwards the event and props to Plausible", () => {
    const plausible = vi.fn();
    window.plausible = plausible;

    track("Subscribed", {
      props: { plan: "team", interval: "annual", revenue_usd: 150 },
    });

    expect(plausible).toHaveBeenCalledWith("Subscribed", {
      props: { plan: "team", interval: "annual", revenue_usd: 150 },
    });
  });

  it("never lets an analytics failure reach the caller", () => {
    window.plausible = () => {
      throw new Error("blocked");
    };

    expect(() => track("Invite Sent")).not.toThrow();
  });
});
