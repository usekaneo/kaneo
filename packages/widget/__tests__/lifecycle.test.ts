import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createSDK } from "../src/core/sdk";

const ORIGIN = "https://feedback.example.com";
let sdk: ReturnType<typeof createSDK>;
let idle: (() => void)[];
let responses: ((value: unknown) => void)[];
let signals: AbortSignal[];

beforeEach(() => {
  vi.useFakeTimers();
  sdk = createSDK();
  idle = [];
  responses = [];
  signals = [];
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => idle.push(cb));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => {
      signals.push(options.signal);
      return new Promise((resolve) => responses.push(resolve));
    }),
  );
});
afterEach(() => {
  sdk.dispatch("destroy");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete window.__QUACKBACK_CONFIG__;
  delete window.__QUACKBACK_URL__;
});

const button = () =>
  document.querySelector<HTMLButtonElement>(".quackback-launcher")!;
function message(data: unknown) {
  const iframe = document.querySelector<HTMLIFrameElement>("iframe")!;
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: ORIGIN,
      source: iframe.contentWindow,
      data,
    }),
  );
}

it("stale fetches and reveal timers cannot apply any state to a later init", async () => {
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  await vi.advanceTimersByTimeAsync(1000);
  sdk.dispatch("init", { instanceUrl: ORIGIN, placement: "right" });
  expect(signals[0].aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(800);
  expect(button().style.opacity).toBe("0");
  responses[0]({
    ok: true,
    json: async () => ({
      position: "left",
      launcherLabel: "Old",
      launcherGreeting: "Stale",
      theme: { lightPrimary: "#ff0000" },
      visitorAnalytics: true,
      visitorDeviceTracking: true,
    }),
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(button().getAttribute("aria-label")).toBe("Open feedback widget");
  expect(button().style.right).toBe("20px");
  expect(button().style.opacity).toBe("0");
  expect(localStorage.getItem("quackback:device-id")).toBeNull();
  responses[1]({ ok: true, json: async () => ({ launcherLabel: "Current" }) });
  await vi.advanceTimersByTimeAsync(0);
  expect(button().getAttribute("aria-label")).toBe("Current");
  expect(button().style.opacity).toBe("1");
});

it("destroy invalidates callbacks, aborts fetches and leaves no owned timers", async () => {
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  const oldIdle = idle[0];
  sdk.dispatch("destroy");
  expect(signals[0].aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  oldIdle();
  expect(document.querySelector("iframe")).toBeNull();
  sdk.dispatch("open", { articleId: "article_saved" });
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  idle[1]();
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  const post = vi.spyOn(
    document.querySelector("iframe")!.contentWindow!,
    "postMessage",
  );
  message({ type: "quackback:ready" });
  expect(post).toHaveBeenCalledWith(
    { type: "quackback:open", data: { articleId: "article_saved" } },
    ORIGIN,
  );
  sdk.dispatch("close");
  sdk.dispatch("destroy");
  expect(vi.getTimerCount()).toBe(0);
  responses.forEach((resolve) =>
    resolve({ ok: true, json: async () => ({ launcherLabel: "Old" }) }),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector(".quackback-launcher")).toBeNull();
});

it.each([
  null,
  {},
  { instanceUrl: ORIGIN, tracking: "true" },
  { instanceUrl: ORIGIN, identity: { id: 4 } },
  { instanceUrl: ORIGIN, placement: "center" },
])("invalid re-init keeps the working instance: %j", (options) => {
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  const existing = button();
  expect(() => sdk.dispatch("init", options)).toThrow();
  expect(button()).toBe(existing);
  expect(signals[0].aborted).toBe(false);
});

it.each([
  null,
  { visitorAnalytics: "true" },
  { visitorAnalytics: true, launcherLabel: 3 },
])("invalid baked config fails closed: %j", (baked) => {
  Object.assign(window, { __QUACKBACK_CONFIG__: baked });
  expect(() => sdk.dispatch("init", { instanceUrl: ORIGIN })).not.toThrow();
  expect(button().style.opacity).toBe("1");
  expect(localStorage.getItem("quackback:device-id")).toBeNull();
});

it("does not apply a baked config from another instance", () => {
  window.__QUACKBACK_URL__ = "https://other.example.com";
  window.__QUACKBACK_CONFIG__ = {
    visitorAnalytics: true,
    visitorDeviceTracking: true,
  };
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  expect(responses).toHaveLength(1);
  expect(localStorage.getItem("quackback:device-id")).toBeNull();
});

it("keeps only the latest identity before readiness and serializes later changes", () => {
  sdk.dispatch("init", {
    instanceUrl: ORIGIN,
    identity: { id: "a", email: "a@test.example" },
  });
  sdk.dispatch("identify", { id: "b", email: "b@test.example" });
  sdk.dispatch("identify");
  sdk.dispatch("open");
  const post = vi.spyOn(
    document.querySelector("iframe")!.contentWindow!,
    "postMessage",
  );
  const identified = vi.fn();
  sdk.dispatch("on", "identify", identified);
  message({ type: "quackback:ready" });
  expect(post).toHaveBeenCalledWith(
    { type: "quackback:identify", data: { anonymous: true } },
    ORIGIN,
  );
  message({ type: "quackback:identify-result", success: true, user: null });
  sdk.dispatch("identify", { id: "a", email: "a@test.example" });
  sdk.dispatch("identify", { id: "b", email: "b@test.example" });
  sdk.dispatch("logout");
  identified.mockClear();
  post.mockClear();
  message({
    type: "quackback:identify-result",
    success: true,
    user: { id: "a", name: "A", email: "a@test.example" },
  });
  expect(sdk.getUser()).toBeNull();
  expect(identified).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledExactlyOnceWith(
    { type: "quackback:identify", data: null },
    ORIGIN,
  );
  message({
    type: "quackback:auth-change",
    user: { id: "a", name: "A", email: "a@test.example" },
  });
  expect(sdk.getUser()).toBeNull();
  message({ type: "quackback:identify-result", success: true, user: null });
  expect(identified).toHaveBeenCalledWith(
    expect.objectContaining({ anonymous: true, user: null }),
  );
});

it("subscriptions survive re-init until their owner unsubscribes", () => {
  const handler = vi.fn();
  const unsubscribe = sdk.dispatch("on", "ready", handler) as () => void;
  for (let i = 0; i < 2; i++) {
    sdk.dispatch("init", { instanceUrl: ORIGIN });
    sdk.dispatch("open");
    message({ type: "quackback:ready" });
    sdk.dispatch("destroy");
  }
  expect(handler).toHaveBeenCalledTimes(2);
  unsubscribe();
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  sdk.dispatch("open");
  message({ type: "quackback:ready" });
  expect(handler).toHaveBeenCalledTimes(2);
});

it("a failed identity send does not block later identity changes or logout", () => {
  sdk.dispatch("init", { instanceUrl: ORIGIN });
  sdk.dispatch("open");
  const post = vi
    .spyOn(document.querySelector("iframe")!.contentWindow!, "postMessage")
    .mockImplementation((data) => {
      structuredClone(data);
    });
  message({ type: "quackback:ready" });
  message({ type: "quackback:identify-result", success: true, user: null });
  expect(() =>
    sdk.dispatch("identify", {
      id: "invalid",
      email: "invalid@example.com",
      custom: () => {},
    }),
  ).toThrow();
  post.mockClear();
  const identity = { id: "valid", email: "valid@example.com" };
  sdk.dispatch("identify", identity);
  expect(post).toHaveBeenCalledExactlyOnceWith(
    { type: "quackback:identify", data: identity },
    ORIGIN,
  );
  message({
    type: "quackback:identify-result",
    success: true,
    user: { ...identity, name: "Valid" },
  });
  sdk.dispatch("logout");
  expect(post).toHaveBeenLastCalledWith(
    { type: "quackback:identify", data: null },
    ORIGIN,
  );
});
