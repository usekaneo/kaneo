import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBoardSort } from "./use-board-sort";

describe("useBoardSort", () => {
  const storageKey = "kaneo:board-sort:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores persisted sort from storage", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ field: "priority", direction: "desc" }),
    );

    const { result } = renderHook(() => useBoardSort("project-1"));

    await waitFor(() => {
      expect(result.current.sort).toEqual({
        field: "priority",
        direction: "desc",
      });
    });
  });

  it("falls back to the default sort when stored JSON is invalid", async () => {
    window.localStorage.setItem(storageKey, "not-json{");

    const { result } = renderHook(() => useBoardSort("project-1"));

    await waitFor(() => {
      expect(result.current.sort).toEqual({
        field: "position",
        direction: "asc",
      });
    });
  });

  it("writes sort changes to storage", async () => {
    const { result } = renderHook(() => useBoardSort("project-1"));

    act(() => {
      result.current.setSort({ field: "dueDate", direction: "desc" });
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey)).toBe(
        JSON.stringify({ field: "dueDate", direction: "desc" }),
      );
    });
  });

  it("falls back to the default sort when the stored field is invalid", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ field: "not-a-field", direction: "desc" }),
    );

    const { result } = renderHook(() => useBoardSort("project-1"));

    await waitFor(() => {
      expect(result.current.sort).toEqual({
        field: "position",
        direction: "asc",
      });
    });
  });
});
