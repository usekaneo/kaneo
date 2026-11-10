import { describe, it, expect } from "vite-plus/test";
import { renderHook } from "@testing-library/react";
import { useQuackback } from "../../src/react/use-quackback";
import Quackback from "../../src";

describe("useQuackback", () => {
  it("returns the Quackback singleton", () => {
    const { result } = renderHook(() => useQuackback());
    expect(result.current).toBe(Quackback);
    expect(typeof result.current.open).toBe("function");
    expect(typeof result.current.identify).toBe("function");
  });
});
