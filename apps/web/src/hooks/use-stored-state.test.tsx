import { act, renderHook } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useStoredState } from "./use-stored-state";

const parse = (raw: unknown) => (typeof raw === "string" ? raw : "none");
const strict = ({ children }: { children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);

afterEach(() => window.localStorage.clear());

describe("useStoredState", () => {
  it("keeps the stored value when effects run twice on mount", () => {
    window.localStorage.setItem("key-a", JSON.stringify("saved"));

    const { result } = renderHook(
      () => useStoredState("key-a", parse, "none"),
      { wrapper: strict },
    );

    expect(result.current[0]).toBe("saved");
    expect(window.localStorage.getItem("key-a")).toBe(JSON.stringify("saved"));
  });

  it("switches to the next key without copying the previous value", () => {
    window.localStorage.setItem("key-a", JSON.stringify("first"));
    window.localStorage.setItem("key-b", JSON.stringify("second"));

    const { result, rerender } = renderHook(
      ({ storageKey }) => useStoredState(storageKey, parse, "none"),
      { initialProps: { storageKey: "key-a" } },
    );
    rerender({ storageKey: "key-b" });

    expect(result.current[0]).toBe("second");
    expect(window.localStorage.getItem("key-a")).toBe(JSON.stringify("first"));
    expect(window.localStorage.getItem("key-b")).toBe(JSON.stringify("second"));
  });

  it("writes updates under the current key", () => {
    const { result } = renderHook(() => useStoredState("key-a", parse, "none"));

    act(() => result.current[1]("changed"));

    expect(result.current[0]).toBe("changed");
    expect(window.localStorage.getItem("key-a")).toBe(
      JSON.stringify("changed"),
    );
  });
});
