// @vitest-environment happy-dom
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";

const trackers: Array<{
  deviceId: string | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("../src/core/tracker", () => ({
  createTracker: (_instanceUrl: string, deviceId: string | null) => {
    const tracker = { deviceId, start: vi.fn(), stop: vi.fn() };
    trackers.push(tracker);
    return tracker;
  },
}));

const { createSDK } = await import("../src/core/sdk");

let sdk: ReturnType<typeof createSDK> | undefined;

const ORIGIN = "https://feedback.acme.com";
const DEVICE_KEY = "quackback:device-id";

function bakeConfig(visitorDeviceTracking = true) {
  (window as { __QUACKBACK_CONFIG__?: unknown }).__QUACKBACK_CONFIG__ = {
    visitorAnalytics: true,
    visitorDeviceTracking,
  };
}

describe("sdk host-page tracking", () => {
  beforeEach(() => {
    trackers.length = 0;
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: () => void) => {
        cb();
        return 1;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());
  });
  afterEach(() => {
    sdk?.dispatch("destroy");
    sdk = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as { __QUACKBACK_CONFIG__?: unknown }).__QUACKBACK_CONFIG__;
  });

  it("starts the tracker and mints a device id when the instance enables it", () => {
    bakeConfig();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(trackers).toHaveLength(1);
    expect(trackers[0].start).toHaveBeenCalled();
    expect(trackers[0].deviceId).toBeTruthy();
    expect(window.localStorage.getItem(DEVICE_KEY)).toBe(trackers[0].deviceId);
  });

  it("init with { tracking: false } sends no pageviews and stores no device id", () => {
    bakeConfig();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, tracking: false });
    expect(trackers).toHaveLength(0);
    expect(window.localStorage.getItem(DEVICE_KEY)).toBeNull();
    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).not.toBeNull();
  });

  it("tracking(true) after init starts the tracker the instance allows", () => {
    bakeConfig();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, tracking: false });
    sdk.dispatch("tracking", true);
    expect(trackers).toHaveLength(1);
    expect(trackers[0].start).toHaveBeenCalled();
    expect(window.localStorage.getItem(DEVICE_KEY)).toBe(trackers[0].deviceId);
  });

  it("tracking(true) applied before the server config arrives takes effect on arrival", async () => {
    let respond: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            respond = resolve;
          }),
      ),
    );
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, tracking: false });
    sdk.dispatch("tracking", true);
    expect(trackers).toHaveLength(0);
    respond({
      ok: true,
      json: async () => ({
        visitorAnalytics: true,
        visitorDeviceTracking: false,
      }),
    });
    await vi.waitFor(() => expect(trackers).toHaveLength(1));
    expect(trackers[0].deviceId).toBeNull();
  });

  it("tracking(true) never starts a tracker the instance has turned off", () => {
    (window as { __QUACKBACK_CONFIG__?: unknown }).__QUACKBACK_CONFIG__ = {
      visitorAnalytics: false,
    };
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, tracking: false });
    sdk.dispatch("tracking", true);
    expect(trackers).toHaveLength(0);
  });

  it("tracking(false) stops the tracker and removes the device id", () => {
    bakeConfig();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(window.localStorage.getItem(DEVICE_KEY)).not.toBeNull();
    sdk.dispatch("tracking", false);
    expect(trackers[0].stop).toHaveBeenCalled();
    expect(window.localStorage.getItem(DEVICE_KEY)).toBeNull();
  });

  it("tracking(true) twice keeps a single tracker running", () => {
    bakeConfig();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    sdk.dispatch("tracking", true);
    sdk.dispatch("tracking", true);
    // A restarted tracker would beacon the current page again.
    expect(trackers).toHaveLength(1);
    expect(trackers[0].stop).not.toHaveBeenCalled();
  });

  it("tracking(false) before init holds through an init without the option", () => {
    bakeConfig();
    sdk = createSDK();
    sdk.dispatch("tracking", false);
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(trackers).toHaveLength(0);
  });

  it("a withdrawal holds through destroy and a later init without the option", () => {
    bakeConfig();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    sdk.dispatch("tracking", false);
    sdk.dispatch("destroy");
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(trackers).toHaveLength(1);
    expect(window.localStorage.getItem(DEVICE_KEY)).toBeNull();
  });

  it("tracking(false) tells a ready panel to forget the device id", () => {
    bakeConfig();
    const postMessage = vi.fn();
    vi.spyOn(
      HTMLIFrameElement.prototype,
      "contentWindow",
      "get",
    ).mockReturnValue({
      postMessage,
    } as unknown as Window);
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ORIGIN,
        source: document.querySelector<HTMLIFrameElement>(
          "iframe.quackback-widget-iframe",
        )?.contentWindow,
        data: { type: "quackback:ready" },
      }),
    );
    postMessage.mockClear();
    sdk.dispatch("tracking", false);
    expect(postMessage).toHaveBeenCalledWith(
      { type: "quackback:device", data: null },
      ORIGIN,
    );
  });
});
