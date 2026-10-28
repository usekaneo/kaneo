import { describe, expect, it } from "vite-plus/test";
import { getChannelAvailability } from "./get-channel-availability";

const base = {
  emailAddress: "mina@example.com",
  emailEnabled: true,
  gotifyConfigured: false,
  gotifyEnabled: false,
  ntfyConfigured: true,
  ntfyEnabled: false,
  webhookConfigured: true,
  webhookEnabled: true,
};

describe("getChannelAvailability", () => {
  it("maps each channel to its delivery state", () => {
    expect(getChannelAvailability(base)).toEqual({
      email: "available",
      gotify: "notConnected",
      ntfy: "paused",
      webhook: "available",
    });
  });

  it("treats email as off when disabled and not connected without an address", () => {
    expect(getChannelAvailability({ ...base, emailEnabled: false }).email).toBe(
      "off",
    );
    expect(getChannelAvailability({ ...base, emailAddress: null }).email).toBe(
      "notConnected",
    );
  });

  it("ignores an enabled flag on a channel that is not configured", () => {
    expect(
      getChannelAvailability({
        ...base,
        gotifyConfigured: false,
        gotifyEnabled: true,
      }).gotify,
    ).toBe("notConnected");
  });
});
