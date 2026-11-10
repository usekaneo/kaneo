import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";
import { createTracker, type Tracker } from "../src/core/tracker";

const INSTANCE = "https://feedback.example.com";

let sendBeacon: ReturnType<typeof vi.fn>;
let tracker: Tracker | null = null;

function sentBodies(): Array<{
  url: string;
  referrer: string;
  surface: string;
}> {
  return sendBeacon.mock.calls.map((c) => JSON.parse(c[1] as string));
}

beforeEach(() => {
  sendBeacon = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, "sendBeacon", {
    value: sendBeacon,
    configurable: true,
  });
  Object.defineProperty(navigator, "doNotTrack", {
    value: null,
    configurable: true,
  });
  window.history.replaceState({}, "", "/start");
});

afterEach(() => {
  tracker?.stop();
  tracker = null;
});

describe("createTracker", () => {
  it("sends an initial pageview with the host URL on start", () => {
    tracker = createTracker(INSTANCE);
    tracker.start();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(`${INSTANCE}/api/track`);
    const body = sentBodies()[0];
    expect(body.surface).toBe("widget");
    expect(body.url).toContain("/start");
  });

  it("tracks pushState/replaceState navigations, deduped on href", () => {
    tracker = createTracker(INSTANCE);
    tracker.start();

    window.history.pushState({}, "", "/page-2");
    window.history.replaceState({}, "", "/page-2"); // same href: no new beacon
    window.history.pushState({}, "", "/page-3");

    const urls = sentBodies().map((b) => new URL(b.url).pathname);
    expect(urls).toEqual(["/start", "/page-2", "/page-3"]);
  });

  it("stop() restores history methods and stops sending", () => {
    const originalPush = window.history.pushState;
    tracker = createTracker(INSTANCE);
    tracker.start();
    tracker.stop();

    expect(window.history.pushState).toBe(originalPush);
    window.history.pushState({}, "", "/after-stop");
    expect(sendBeacon).toHaveBeenCalledTimes(1); // only the initial view
  });

  it("does nothing when DNT is set", () => {
    Object.defineProperty(navigator, "doNotTrack", {
      value: "1",
      configurable: true,
    });
    tracker = createTracker(INSTANCE);
    tracker.start();
    window.history.pushState({}, "", "/dnt-page");
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("includes the device id on every beacon when provided", () => {
    tracker = createTracker(INSTANCE, "dev-abc");
    tracker.start();
    window.history.pushState({}, "", "/second");

    const bodies = sentBodies() as Array<{ deviceId?: string }>;
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body.deviceId).toBe("dev-abc");
    }
  });

  it("omits the device id field when not provided", () => {
    tracker = createTracker(INSTANCE);
    tracker.start();
    expect("deviceId" in sentBodies()[0]).toBe(false);
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    Object.defineProperty(navigator, "sendBeacon", {
      value: undefined,
      configurable: true,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null));
    tracker = createTracker(INSTANCE);
    tracker.start();

    expect(fetchSpy).toHaveBeenCalledWith(
      `${INSTANCE}/api/track`,
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    fetchSpy.mockRestore();
  });
});

for (const method of ["pushState", "replaceState"] as const) {
  it(`${method}: retained host wrappers stay callable across stop/restart`, () => {
    const original = window.history[method];
    tracker = createTracker(INSTANCE);
    tracker.start();
    const wrapped = window.history[method];
    const host = vi.fn(function (
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      return wrapped.apply(this, args);
    });
    window.history[method] = host;
    try {
      tracker.stop();
      expect(window.history[method]).toBe(host);
      expect(() => window.history[method]({}, "", "/stopped")).not.toThrow();
      expect(sendBeacon).toHaveBeenCalledTimes(1);
      tracker.start();
      window.history[method]({}, "", "/restarted");
      expect(sendBeacon).toHaveBeenCalledTimes(3);
      tracker.stop();
      expect(window.history[method]).toBe(host);
      expect(() =>
        window.history[method]({}, "", "/stopped-again"),
      ).not.toThrow();
      expect(sendBeacon).toHaveBeenCalledTimes(3);
    } finally {
      tracker.stop();
      window.history[method] = original;
    }
  });
}
