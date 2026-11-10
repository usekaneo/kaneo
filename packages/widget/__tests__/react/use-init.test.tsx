import { StrictMode } from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";
import { render, act, cleanup } from "@testing-library/react";
import { useQuackbackInit } from "../../src/react/use-init";
import Quackback from "../../src";

const ORIGIN = "https://feedback.acme.com";

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({}) })),
  );
  // Flush the SDK's idle-time panel preload synchronously so assertions can
  // check the iframe right after init.
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
  cleanup();
  Quackback.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useQuackbackInit", () => {
  it("inits the widget on mount and destroys on unmount", () => {
    const destroy = vi.spyOn(Quackback, "destroy");
    function C() {
      useQuackbackInit({ instanceUrl: ORIGIN });
      return null;
    }
    const { unmount } = render(<C />);
    expect(
      document.querySelector("iframe.quackback-widget-iframe"),
    ).not.toBeNull();
    unmount();
    expect(destroy).toHaveBeenCalled();
  });

  it("re-calls identify when the identity option changes", () => {
    const identify = vi.spyOn(Quackback, "identify");
    function C({ user }: { user: { id: string; email: string } | null }) {
      useQuackbackInit({
        instanceUrl: ORIGIN,
        identity: user ? { id: user.id, email: user.email } : undefined,
      });
      return null;
    }
    const { rerender, unmount } = render(
      <C user={{ id: "u1", email: "a@b.c" }} />,
    );
    identify.mockClear();
    act(() => rerender(<C user={{ id: "u2", email: "x@y.z" }} />));
    expect(identify).toHaveBeenCalledWith({ id: "u2", email: "x@y.z" });
    unmount();
  });

  it("does not init when shouldInitialize is false", () => {
    function C() {
      useQuackbackInit({ instanceUrl: ORIGIN, shouldInitialize: false });
      return null;
    }
    render(<C />);
    expect(document.querySelector("iframe.quackback-widget-iframe")).toBeNull();
  });

  it("inits later when shouldInitialize flips to true", () => {
    function C({ enabled }: { enabled: boolean }) {
      useQuackbackInit({ instanceUrl: ORIGIN, shouldInitialize: enabled });
      return null;
    }
    const { rerender, unmount } = render(<C enabled={false} />);
    expect(document.querySelector("iframe.quackback-widget-iframe")).toBeNull();
    act(() => rerender(<C enabled={true} />));
    expect(
      document.querySelector("iframe.quackback-widget-iframe"),
    ).not.toBeNull();
    unmount();
  });

  it("respects initializeDelay", () => {
    vi.useFakeTimers();
    // Fake timers replace the sync requestIdleCallback stub — restore it so
    // the panel preload still flushes inline once init fires.
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: () => void) => {
        cb();
        return 1;
      }),
    );
    function C() {
      useQuackbackInit({ instanceUrl: ORIGIN, initializeDelay: 500 });
      return null;
    }
    const { unmount } = render(<C />);
    expect(document.querySelector("iframe.quackback-widget-iframe")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(
      document.querySelector("iframe.quackback-widget-iframe"),
    ).not.toBeNull();
    unmount();
    vi.useRealTimers();
  });
});

it("changes user A to B to anonymous before readiness", () => {
  const identify = vi.spyOn(Quackback, "identify");
  function C({ id }: { id?: string }) {
    useQuackbackInit({
      instanceUrl: ORIGIN,
      identity: id ? { id, email: `${id}@test.example` } : undefined,
    });
    return null;
  }
  const { rerender, unmount } = render(<C id="a" />);
  rerender(<C id="b" />);
  expect(identify).toHaveBeenLastCalledWith({
    id: "b",
    email: "b@test.example",
  });
  rerender(<C />);
  expect(identify).toHaveBeenLastCalledWith(undefined);
  unmount();
});

it("delayed startup uses the latest identity and ignores changes until initialized", () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestIdleCallback", undefined);
  const init = vi.spyOn(Quackback, "init");
  const identify = vi.spyOn(Quackback, "identify");
  function C({
    id,
    enabled = true,
    url = ORIGIN,
  }: {
    id?: string;
    enabled?: boolean;
    url?: string;
  }) {
    useQuackbackInit({
      instanceUrl: url,
      shouldInitialize: enabled,
      initializeDelay: 500,
      identity: id ? { id, email: `${id}@test.example` } : undefined,
    });
    return null;
  }
  const { rerender, unmount } = render(<C id="a" />);
  rerender(<C id="b" />);
  expect(identify).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(500));
  expect(init).toHaveBeenLastCalledWith(
    expect.objectContaining({ identity: { id: "b", email: "b@test.example" } }),
  );
  rerender(<C />);
  expect(identify).toHaveBeenLastCalledWith(undefined);
  rerender(<C enabled={false} id="c" />);
  identify.mockClear();
  init.mockClear();
  act(() => vi.advanceTimersByTime(500));
  expect(init).not.toHaveBeenCalled();
  expect(identify).not.toHaveBeenCalled();
  rerender(<C enabled id="d" url="https://second.example.com" />);
  act(() => vi.advanceTimersByTime(500));
  expect(init).toHaveBeenLastCalledWith(
    expect.objectContaining({
      instanceUrl: "https://second.example.com",
      identity: { id: "d", email: "d@test.example" },
    }),
  );
  unmount();
  vi.useRealTimers();
});

it("Strict Mode leaves one instance and cancels a delayed unmount", () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestIdleCallback", undefined);
  const init = vi.spyOn(Quackback, "init");
  function C({ delay = 0 }: { delay?: number }) {
    useQuackbackInit({ instanceUrl: ORIGIN, initializeDelay: delay });
    return null;
  }
  const mounted = render(
    <StrictMode>
      <C />
    </StrictMode>,
  );
  expect(document.querySelectorAll(".quackback-launcher")).toHaveLength(1);
  mounted.unmount();
  expect(document.querySelector(".quackback-launcher")).toBeNull();
  init.mockClear();
  const delayed = render(
    <StrictMode>
      <C delay={500} />
    </StrictMode>,
  );
  delayed.unmount();
  act(() => vi.advanceTimersByTime(500));
  expect(init).not.toHaveBeenCalled();
  vi.useRealTimers();
});
