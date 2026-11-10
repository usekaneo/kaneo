import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createSDK } from "../src/core/sdk";

let sdk: ReturnType<typeof createSDK>;
const DEVICE_KEY = "quackback:device-id";
const ORIGIN = "https://feedback.example.com";
beforeEach(() => {
  sdk = createSDK();
  localStorage.clear();
  window.__QUACKBACK_CONFIG__ = {
    visitorAnalytics: true,
    visitorDeviceTracking: true,
  };
  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelIdleCallback", vi.fn());
});
afterEach(() => {
  sdk.dispatch("destroy");
  delete window.__QUACKBACK_CONFIG__;
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["doNotTrack", "globalPrivacyControl"])(
  "%s blocks device access, storage, beacons and iframe identity",
  (signal) => {
    const navigatorValue = navigator;
    vi.stubGlobal(
      "navigator",
      new Proxy(navigatorValue, {
        get(target, key) {
          if (key === signal) return signal === "doNotTrack" ? "1" : true;
          return Reflect.get(target, key, target);
        },
      }),
    );
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const uuid = vi.spyOn(crypto, "randomUUID");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    sdk.dispatch("tracking", true);
    sdk.dispatch("open");
    const frame = document.querySelector("iframe")!;
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ORIGIN,
        source: frame.contentWindow,
        data: { type: "quackback:ready" },
      }),
    );
    expect(get).not.toHaveBeenCalledWith(DEVICE_KEY);
    expect(set).not.toHaveBeenCalledWith(DEVICE_KEY, expect.anything());
    expect(uuid).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(
      post.mock.calls.some(([message]) => message.type === "quackback:device"),
    ).toBe(false);
  },
);

it("host consent false removes existing device identity and survives re-init", () => {
  localStorage.setItem(DEVICE_KEY, "old-device");
  sdk.dispatch("init", { instanceUrl: ORIGIN, tracking: false });
  expect(localStorage.getItem(DEVICE_KEY)).toBeNull();
  sdk.dispatch("destroy");
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  expect(localStorage.getItem(DEVICE_KEY)).toBeNull();
});

it.each(["pushState", "replaceState"] as const)(
  "consent withdrawal leaves a later host %s wrapper usable",
  (method) => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });
    const original = history[method];
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const wrapped = history[method];
    const host = function (
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      return wrapped.apply(this, args);
    };
    history[method] = host;
    try {
      sdk.dispatch("tracking", false);
      expect(history[method]).toBe(host);
      expect(() => history[method]({}, "", "/withdrawn")).not.toThrow();
      expect(beacon).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(DEVICE_KEY)).toBeNull();
      sdk.dispatch("open");
      expect(sdk.isOpen()).toBe(true);
    } finally {
      history[method] = original;
      delete navigator.sendBeacon;
    }
  },
);

it("analytics transport failures cannot break navigation or the widget", () => {
  Object.defineProperty(navigator, "sendBeacon", {
    value: () => {
      throw new Error("blocked");
    },
    configurable: true,
  });
  try {
    expect(() => sdk.dispatch("init", { instanceUrl: ORIGIN })).not.toThrow();
    expect(() => history.pushState({}, "", "/transport-failure")).not.toThrow();
    sdk.dispatch("open");
    expect(sdk.isOpen()).toBe(true);
  } finally {
    delete navigator.sendBeacon;
  }
});
