import { describe, expect, it } from "vite-plus/test";
import { getSessionDeviceLabel } from "./get-session-device-label";

const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

describe("getSessionDeviceLabel", () => {
  it("names browser and system together", () => {
    expect(getSessionDeviceLabel({ browser: "Firefox", os: "Linux" }, t)).toBe(
      'settings:sessions.device:{"browser":"Firefox","os":"Linux"}',
    );
  });

  it("falls back to whichever half is known", () => {
    expect(getSessionDeviceLabel({ browser: null, os: "iPhone" }, t)).toBe(
      "iPhone",
    );
    expect(getSessionDeviceLabel({ browser: "Safari", os: null }, t)).toBe(
      "Safari",
    );
  });

  it("says when the device is unknown", () => {
    expect(getSessionDeviceLabel({ browser: null, os: null }, t)).toBe(
      "settings:sessions.unknownDevice",
    );
  });
});
