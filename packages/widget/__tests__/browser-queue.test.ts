// @vitest-environment happy-dom
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";

// The browser-queue module runs side-effects at import time, so each test
// needs a fresh import with isolated module state.

declare global {
  interface Window {
    Quackback?: ((...args: unknown[]) => unknown) & { q?: IArguments[] };
    __QUACKBACK_URL__?: string;
  }
}

function mockSDK(): unknown[][] {
  const dispatched: unknown[][] = [];
  vi.doMock("../src/core/sdk", () => ({
    createSDK: () => ({
      dispatch: (...args: unknown[]) => {
        dispatched.push(args);
      },
      isOpen: () => false,
      getUser: () => null,
      isIdentified: () => false,
    }),
  }));
  return dispatched;
}

function installQueueStub(): void {
  const q: IArguments[] = [];
  const queueFn = function (this: void) {
    // oxlint-disable-next-line prefer-rest-params
    q.push(arguments);
  } as ((...args: unknown[]) => unknown) & { q: IArguments[] };
  queueFn.q = q;
  window.Quackback = queueFn;
}

describe("browser-queue", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as Window).Quackback;
    delete (window as Window).__QUACKBACK_URL__;
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    // Flush the real SDK's idle-time panel preload synchronously so the
    // end-to-end tests can assert panel DOM right after init.
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
    window.Quackback?.("destroy");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("replays queued commands through the SDK after the script loads", async () => {
    const dispatched = mockSDK();
    installQueueStub();
    window.Quackback!("init", { instanceUrl: "https://feedback.acme.com" });
    window.Quackback!("identify", { id: "u1", email: "a@b.c" });

    await import("../src/browser-queue");

    expect(dispatched[0]).toEqual([
      "init",
      { instanceUrl: "https://feedback.acme.com" },
      undefined,
    ]);
    expect(dispatched[1]).toEqual([
      "identify",
      { id: "u1", email: "a@b.c" },
      undefined,
    ]);
  });

  it("replaces window.Quackback with a live dispatcher after loading", async () => {
    vi.doMock("../src/core/sdk", () => ({
      createSDK: () => ({
        dispatch: () => "DISPATCHED",
        isOpen: () => false,
        getUser: () => null,
        isIdentified: () => false,
      }),
    }));

    await import("../src/browser-queue");

    expect(typeof window.Quackback).toBe("function");
    expect((window.Quackback as (...args: unknown[]) => unknown)("open")).toBe(
      "DISPATCHED",
    );
  });

  it("auto-dispatches init with the baked instance URL if no init was queued", async () => {
    const dispatched = mockSDK();
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";

    await import("../src/browser-queue");
    await new Promise((r) => setTimeout(r, 0));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual([
      "init",
      { instanceUrl: "https://feedback.acme.com" },
      undefined,
    ]);
  });

  it("folds the baked instance URL into a queued init that omits it", async () => {
    const dispatched = mockSDK();
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";
    installQueueStub();
    // Script-tag installs omit instanceUrl — it's baked into the served sdk.js.
    window.Quackback!("init", { launcher: false, placement: "left" });

    await import("../src/browser-queue");

    expect(dispatched[0]).toEqual([
      "init",
      {
        launcher: false,
        placement: "left",
        instanceUrl: "https://feedback.acme.com",
      },
      undefined,
    ]);
  });

  it("an explicit init dispatched after load is not pre-empted by the auto-init", async () => {
    const dispatched = mockSDK();
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";

    await import("../src/browser-queue");

    // Host page's config call lands after the bundle loaded (e.g. from React).
    window.Quackback!("init", { launcher: false, placement: "left" });

    // Let the deferred auto-init fall through.
    await new Promise((r) => setTimeout(r, 0));

    const inits = dispatched.filter((d) => d[0] === "init");
    expect(inits).toHaveLength(1);
    expect(inits[0][1]).toEqual({
      launcher: false,
      placement: "left",
      instanceUrl: "https://feedback.acme.com",
    });
  });

  it('folds the baked instance URL into a bare queued `Quackback("init")` call', async () => {
    const dispatched = mockSDK();
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";
    installQueueStub();
    // The documented admin snippet — no second argument at all.
    window.Quackback!("init");

    await import("../src/browser-queue");

    expect(dispatched[0]).toEqual([
      "init",
      { instanceUrl: "https://feedback.acme.com" },
      undefined,
    ]);
  });

  it("destroy before the deferred fallback suppresses it", async () => {
    const dispatched = mockSDK();
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";

    await import("../src/browser-queue");
    window.Quackback!("destroy");
    await new Promise((r) => setTimeout(r, 0));

    // Host explicitly destroyed — the fallback must not spawn a default widget.
    const inits = dispatched.filter((d) => d[0] === "init");
    expect(inits).toHaveLength(0);
  });

  it('end-to-end: fallback first, then a host init({launcher:false, placement:"left"}) destroys + rebuilds', async () => {
    // The user's actual reported scenario: bundle loads, fallback auto-init
    // fires (default launcher on right), then app/React code's init lands
    // and must reconfigure. Exercises both halves at the seam.
    vi.doUnmock("../src/core/sdk");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ theme: {} }) })),
    );
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";

    await import("../src/browser-queue");
    // Let the deferred fallback fire first.
    await new Promise((r) => setTimeout(r, 0));
    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).not.toBeNull();

    // Host's explicit init must destroy + rebuild with the new options.
    window.Quackback!("init", { launcher: false, placement: "left" });

    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).toBeNull();
    const styles =
      document.getElementById("quackback-widget-styles")?.textContent ?? "";
    expect(styles).toContain("left:16px");
    expect(styles).not.toContain("right:16px");
  });

  it('end-to-end: a post-load init({launcher:false, placement:"left"}) reconfigures the DOM', async () => {
    // doMock leaks across vi.resetModules; unmock so this test runs through
    // the real SDK and catches regressions on either side of the fix.
    vi.doUnmock("../src/core/sdk");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ theme: {} }) })),
    );
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";

    await import("../src/browser-queue");

    window.Quackback!("init", { launcher: false, placement: "left" });
    await new Promise((r) => setTimeout(r, 0));

    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).toBeNull();
    expect(document.querySelector(".quackback-panel")).not.toBeNull();
    const styles =
      document.getElementById("quackback-widget-styles")?.textContent ?? "";
    expect(styles).toContain("left:16px");
    expect(styles).not.toContain("right:16px");
  });

  it("does not auto-init if the queue already contains an init call", async () => {
    const dispatched = mockSDK();
    window.__QUACKBACK_URL__ = "https://feedback.acme.com";
    installQueueStub();
    window.Quackback!("init", { instanceUrl: "https://override.example" });

    await import("../src/browser-queue");
    await new Promise((r) => setTimeout(r, 0));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual([
      "init",
      { instanceUrl: "https://override.example" },
      undefined,
    ]);
  });
});
