// @vitest-environment happy-dom
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";
import { createSDK } from "../src/core/sdk";

let sdk: ReturnType<typeof createSDK> | undefined;

const ORIGIN = "https://feedback.acme.com";

function stubIframe() {
  const postMessage = vi.fn();
  const spy = vi
    .spyOn(HTMLIFrameElement.prototype, "contentWindow", "get")
    .mockReturnValue({ postMessage } as unknown as Window);
  return { postMessage, spy };
}

function fireReady() {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: ORIGIN,
      source: document.querySelector<HTMLIFrameElement>(
        "iframe.quackback-widget-iframe",
      )?.contentWindow,
      data: { type: "quackback:ready" },
    }),
  );
}

describe("sdk", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ theme: {} }) })),
    );
    // The panel preloads in an idle slot; flush it synchronously so tests can
    // keep asserting the iframe right after init. Deferral itself is covered
    // by its own test below.
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

  it("init creates a launcher and iframe", () => {
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).not.toBeNull();
    expect(
      document.querySelector("iframe.quackback-widget-iframe"),
    ).not.toBeNull();
  });

  it("init with { launcher: false } does not create a button", () => {
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, launcher: false });
    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).toBeNull();
  });

  it("a repeat init re-applies launcher: false", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).not.toBeNull();
    sdk.dispatch("init", { instanceUrl: ORIGIN, launcher: false });
    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).toBeNull();
  });

  it("a repeat init moves an existing launcher to the new placement", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    sdk.dispatch("init", { instanceUrl: ORIGIN, placement: "left" });
    const btn = document.querySelector(
      'button[aria-label="Open feedback widget"]',
    ) as HTMLButtonElement;
    expect(btn.style.left).toBe("20px");
    expect(btn.style.right).toBe("");
  });

  it("a repeat init that throws leaves the existing instance intact", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(() => sdk.dispatch("init", { instanceUrl: "not a url" })).toThrow();
    // The good first instance is untouched.
    expect(
      document.querySelector("iframe.quackback-widget-iframe"),
    ).not.toBeNull();
  });

  it("init defaults identity to anonymous once iframe is ready", () => {
    const { postMessage, spy } = stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    fireReady();
    expect(postMessage).toHaveBeenCalledWith(
      { type: "quackback:identify", data: { anonymous: true } },
      ORIGIN,
    );
    spy.mockRestore();
  });

  it("init with bundled identity sends it to iframe", () => {
    const { postMessage, spy } = stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", {
      instanceUrl: ORIGIN,
      identity: { id: "u1", email: "a@b.c", name: "Ada" },
    });
    fireReady();
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "quackback:identify",
        data: { id: "u1", email: "a@b.c", name: "Ada" },
      },
      ORIGIN,
    );
    spy.mockRestore();
  });

  it("identify sends the payload after ready", () => {
    const { postMessage, spy } = stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    fireReady();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ORIGIN,
        source:
          document.querySelector<HTMLIFrameElement>("iframe")?.contentWindow,
        data: { type: "quackback:identify-result", success: true, user: null },
      }),
    );
    sdk.dispatch("identify", { id: "u2", email: "b@c.d" });
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "quackback:identify", data: { id: "u2", email: "b@c.d" } },
      ORIGIN,
    );
    spy.mockRestore();
  });

  it("logout sends null identify and keeps the launcher visible", () => {
    const { spy } = stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    fireReady();
    sdk.dispatch("logout");
    const launcher = document.querySelector(
      'button[aria-label="Open feedback widget"]',
    ) as HTMLButtonElement;
    expect(launcher).not.toBeNull();
    expect(launcher.style.display).not.toBe("none");
    spy.mockRestore();
  });

  it("keeps the closed panel out of the tab order and names the frame", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const iframe = document.querySelector(
      "iframe.quackback-widget-iframe",
    ) as HTMLIFrameElement;
    const panel = iframe.parentElement as HTMLElement;
    expect(iframe.title).toBe("Help");
    expect(panel.inert).toBe(true);
    sdk.dispatch("open");
    expect(panel.inert).toBe(false);
    sdk.dispatch("close");
    expect(panel.inert).toBe(true);
  });

  it("names the frame in the visitor language", () => {
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, locale: "de" });
    expect(
      (
        document.querySelector(
          "iframe.quackback-widget-iframe",
        ) as HTMLIFrameElement
      ).title,
    ).toBe("Hilfe");
  });

  it("keeps a close control available while the iframe is loading", () => {
    stubIframe();
    window.__QUACKBACK_CONFIG__ = {};
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    sdk.dispatch("open");
    const launcher = document.querySelector<HTMLButtonElement>(
      ".quackback-launcher",
    )!;
    expect(launcher.style.visibility).toBe("hidden");
    expect(launcher.inert).toBe(true);
    document
      .querySelector<HTMLButtonElement>(".quackback-panel-close")!
      .click();
    expect(sdk.isOpen()).toBe(false);
    expect(launcher.style.visibility).toBe("visible");
    expect(launcher.inert).toBe(false);
    sdk.dispatch("open");
    fireReady();
    expect(document.querySelector(".quackback-panel-close")).toBeNull();
    expect(document.querySelector("iframe")!.src).toContain("showClose=1");
  });

  it("isOpen tracks panel state", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(sdk.isOpen()).toBe(false);
    sdk.dispatch("open");
    expect(sdk.isOpen()).toBe(true);
    sdk.dispatch("close");
    expect(sdk.isOpen()).toBe(false);
  });

  it("getUser / isIdentified reflect identify-result messages", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(sdk.getUser()).toBeNull();
    expect(sdk.isIdentified()).toBe(false);
    fireReady();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ORIGIN,
        source: document.querySelector<HTMLIFrameElement>(
          "iframe.quackback-widget-iframe",
        )?.contentWindow,
        data: {
          type: "quackback:identify-result",
          success: true,
          user: { id: "u1", name: "Ada", email: "a@b.c" },
        },
      }),
    );
    expect(sdk.getUser()).toEqual({ id: "u1", name: "Ada", email: "a@b.c" });
    expect(sdk.isIdentified()).toBe(true);
    sdk.dispatch("logout");
    expect(sdk.getUser()).toBeNull();
    expect(sdk.isIdentified()).toBe(false);
  });

  it("open emits an open event with view context", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const seen: unknown[] = [];
    sdk.dispatch("on", "open", (payload: unknown) => seen.push(payload));
    sdk.dispatch("open", { view: "new-post", title: "Bug:" });
    expect(seen).toHaveLength(1);
    expect((seen[0] as { view: string }).view).toBe("new-post");
  });

  it("open passes deep-link fields to the iframe", () => {
    const { postMessage, spy } = stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    fireReady();
    sdk.dispatch("open", { postId: "post_01h" });
    expect(postMessage).toHaveBeenCalledWith(
      { type: "quackback:open", data: { postId: "post_01h" } },
      ORIGIN,
    );
    sdk.dispatch("open", {
      view: "new-post",
      title: "Bug:",
      body: "steps",
      board: "bug-reports",
    });
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: "quackback:open",
        data: {
          view: "new-post",
          title: "Bug:",
          body: "steps",
          board: "bug-reports",
        },
      },
      ORIGIN,
    );
    spy.mockRestore();
  });

  it("open forwards the messages and tickets views to the iframe", () => {
    const { postMessage, spy } = stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    fireReady();
    sdk.dispatch("open", { view: "messages" });
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "quackback:open", data: { view: "messages" } },
      ORIGIN,
    );
    sdk.dispatch("open", { view: "tickets" });
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "quackback:open", data: { view: "tickets" } },
      ORIGIN,
    );
    spy.mockRestore();
  });

  it("open event carries the messages and tickets views", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const seen: Array<{ view?: string }> = [];
    sdk.dispatch("on", "open", (payload: { view?: string }) =>
      seen.push(payload),
    );
    sdk.dispatch("open", { view: "messages" });
    sdk.dispatch("open", { view: "tickets" });
    expect(seen.map((payload) => payload.view)).toEqual([
      "messages",
      "tickets",
    ]);
  });

  it("metadata merges and sends to iframe", () => {
    const { postMessage, spy } = stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    fireReady();
    sdk.dispatch("metadata", { page: "/settings", app_version: "2.4.1" });
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "quackback:metadata",
        data: { page: "/settings", app_version: "2.4.1" },
      },
      ORIGIN,
    );
    sdk.dispatch("metadata", { page: null });
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "quackback:metadata", data: { app_version: "2.4.1" } },
      ORIGIN,
    );
    spy.mockRestore();
  });

  it("hideLauncher hides the button; showLauncher shows it again", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const launcher = () =>
      document.querySelector(
        'button[aria-label="Open feedback widget"]',
      ) as HTMLButtonElement | null;
    sdk.dispatch("hideLauncher");
    expect(launcher()?.style.display).toBe("none");
    sdk.dispatch("showLauncher");
    expect(launcher()?.style.display).toBe("flex");
  });

  it("launcher starts hidden and reveals as soon as the config fetch resolves", async () => {
    stubIframe();
    let resolveFetch!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const btn = document.querySelector(
      'button[aria-label="Open feedback widget"]',
    ) as HTMLButtonElement;
    expect(btn.style.opacity).toBe("0");
    resolveFetch({ ok: true, json: async () => ({ theme: {} }) });
    // Let the fetch → json → applyServerConfig → finally chain settle. Colors
    // are applied before the reveal, so there is no flash to wait out.
    await new Promise((r) => setTimeout(r, 0));
    expect(btn.style.opacity).toBe("1");
  });

  it("baked __QUACKBACK_CONFIG__ reveals the launcher instantly without a config fetch", () => {
    stubIframe();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.__QUACKBACK_CONFIG__ = {
      theme: {
        lightPrimary: "#ff0000",
        lightPrimaryForeground: "#ffffff",
        themeMode: "light",
      },
      launcherGreeting: "Hi there!",
    };
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const btn = document.querySelector(
      'button[aria-label="Open feedback widget"]',
    ) as HTMLButtonElement;
    expect(btn.style.opacity).toBe("1");
    expect(btn.style.backgroundColor).toBe("#ff0000");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("panel creation waits for the idle slot; open() forces it immediately", () => {
    stubIframe();
    // Capture the idle callback instead of flushing it synchronously.
    let idleCb: (() => void) | null = null;
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: () => void) => {
        idleCb = cb;
        return 1;
      }),
    );
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(document.querySelector("iframe.quackback-widget-iframe")).toBeNull();
    sdk.dispatch("open");
    expect(
      document.querySelector("iframe.quackback-widget-iframe"),
    ).not.toBeNull();
    // The idle slot firing later must not create a second panel.
    idleCb?.();
    expect(
      document.querySelectorAll("iframe.quackback-widget-iframe"),
    ).toHaveLength(1);
  });

  it("launcher reveals via fallback timer if config fetch never resolves", async () => {
    vi.useFakeTimers();
    stubIframe();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    ); // never resolves
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const btn = document.querySelector(
      'button[aria-label="Open feedback widget"]',
    ) as HTMLButtonElement;
    expect(btn.style.opacity).toBe("0");
    vi.advanceTimersByTime(1800);
    expect(btn.style.opacity).toBe("1");
    vi.useRealTimers();
  });

  it("init throws on non-http(s) instanceUrl (javascript: scheme)", () => {
    sdk = createSDK();
    expect(() =>
      sdk.dispatch("init", { instanceUrl: "javascript:alert(1)" }),
    ).toThrow(/instanceUrl must be an http/);
  });

  it("init throws on malformed instanceUrl", () => {
    sdk = createSDK();
    expect(() => sdk.dispatch("init", { instanceUrl: "not a url" })).toThrow(
      /instanceUrl must be an http/,
    );
  });

  it("navigate opens http(s) URLs with noopener,noreferrer", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ORIGIN,
        source: document.querySelector<HTMLIFrameElement>(
          "iframe.quackback-widget-iframe",
        )?.contentWindow,
        data: { type: "quackback:navigate", url: "https://example.com/thing" },
      }),
    );
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/thing",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("navigate ignores javascript: URLs", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ORIGIN,
        source: document.querySelector<HTMLIFrameElement>(
          "iframe.quackback-widget-iframe",
        )?.contentWindow,
        data: { type: "quackback:navigate", url: "javascript:alert(1)" },
      }),
    );
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("destroy removes the iframe and launcher", () => {
    stubIframe();
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    expect(
      document.querySelector("iframe.quackback-widget-iframe"),
    ).not.toBeNull();
    sdk.dispatch("destroy");
    expect(document.querySelector("iframe.quackback-widget-iframe")).toBeNull();
    expect(
      document.querySelector('button[aria-label="Open feedback widget"]'),
    ).toBeNull();
  });

  it("an iframe unread count drives the launcher badge and unread subscribers", () => {
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    const handler = vi.fn();
    sdk.dispatch("on", "unread", handler);

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: ORIGIN,
        source: document.querySelector<HTMLIFrameElement>(
          "iframe.quackback-widget-iframe",
        )?.contentWindow,
        data: { type: "quackback:unread", count: 5 },
      }),
    );

    // Host subscribers get the count...
    expect(handler).toHaveBeenCalledWith({ count: 5 });
    // ...and the launcher shows the badge.
    const badge = (
      document.querySelector(
        'button[aria-label="Open feedback widget"]',
      ) as HTMLButtonElement
    ).lastElementChild as HTMLElement;
    expect(badge.style.display).toBe("flex");
    expect(badge.textContent).toBe("5");
  });
});

describe("sdk server-driven launcher config", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
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

  it("server config position and label reach the launcher, overriding init placement", () => {
    stubIframe();
    window.__QUACKBACK_CONFIG__ = {
      position: "left",
      launcherLabel: "Chat with us",
    };
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, placement: "right" });
    const btn = document.querySelector(
      'button[aria-label="Chat with us"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.style.left).toBe("20px");
    expect(btn.style.right).toBe("");
    expect(btn.textContent).toContain("Chat with us");
  });

  it("a fetched server config positions and labels the launcher", async () => {
    stubIframe();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ position: "left", launcherLabel: "Feedback" }),
      })),
    );
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.querySelector(
      'button[aria-label="Feedback"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.style.left).toBe("20px");
  });

  it("no server position keeps the init placement", () => {
    stubIframe();
    window.__QUACKBACK_CONFIG__ = { theme: {} };
    sdk = createSDK();
    sdk.dispatch("init", { instanceUrl: ORIGIN, placement: "left" });
    const btn = document.querySelector(
      'button[aria-label="Open feedback widget"]',
    ) as HTMLButtonElement;
    expect(btn.style.left).toBe("20px");
  });
});
