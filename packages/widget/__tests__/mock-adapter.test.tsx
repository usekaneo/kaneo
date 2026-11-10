import { StrictMode, type PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  createMockBackend,
  emptySnapshot,
  type WidgetSnapshot,
} from "../stories/mock-backend.js";
import { useMockWidget } from "../stories/useMockWidget.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("rejects a late old-visitor load even when the transport ignores abort", async () => {
  const backend = createMockBackend(emptySnapshot, 0);
  let resolveOld!: (data: WidgetSnapshot) => void;
  let oldSignal!: AbortSignal;
  vi.spyOn(backend, "load").mockImplementationOnce((_visitor, signal) => {
    oldSignal = signal;
    return new Promise((resolve) => {
      resolveOld = resolve;
    });
  });
  const hook = renderHook(
    ({ visitor }) => useMockWidget(backend, visitor, false),
    { initialProps: { visitor: "a" } },
  );
  hook.rerender({ visitor: "b" });
  expect(oldSignal.aborted).toBe(true);
  expect(hook.result.current.data.conversations).toEqual([]);
  await waitFor(() => expect(hook.result.current.loadState).toBe("ready"));
  await act(async () =>
    resolveOld({
      ...emptySnapshot,
      conversations: [{ id: "private-a", title: "Private", messages: [] }],
    }),
  );
  expect(hook.result.current.data.conversations).toEqual([]);
});

it("owns timers across Strict Mode setup, identity changes, pending writes, and unmount", async () => {
  vi.useFakeTimers();
  const backend = createMockBackend(emptySnapshot, 100);
  const wrapper = ({ children }: PropsWithChildren) => (
    <StrictMode>{children}</StrictMode>
  );
  const hook = renderHook(
    ({ visitor }) => useMockWidget(backend, visitor, false),
    { wrapper, initialProps: { visitor: "a" } },
  );
  expect(vi.getTimerCount()).toBe(1);
  await act(() => vi.advanceTimersByTimeAsync(100));
  let write!: Promise<unknown>;
  act(() => {
    write = hook.result.current.perform((signal) =>
      backend.send("a", "Private A", { idempotencyKey: "key" }, signal),
    );
  });
  const aborted = expect(write).rejects.toHaveProperty("name", "AbortError");
  hook.rerender({ visitor: "b" });
  await aborted;
  await act(() => vi.advanceTimersByTimeAsync(100));
  expect(hook.result.current.data.conversations).toEqual([]);
  hook.rerender({ visitor: "anonymous" });
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
  const load = backend.load("a", new AbortController().signal);
  await vi.advanceTimersByTimeAsync(100);
  expect((await load).conversations).toEqual([]);
});
