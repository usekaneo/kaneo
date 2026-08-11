import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUserPreferencesStore } from "./user-preferences";

describe("user preferences view mode", () => {
  it("supports switching between board, board3d and list", () => {
    act(() => {
      useUserPreferencesStore.getState().setViewMode("board3d");
    });
    expect(useUserPreferencesStore.getState().viewMode).toBe("board3d");

    act(() => {
      useUserPreferencesStore.getState().setViewMode("list");
    });
    expect(useUserPreferencesStore.getState().viewMode).toBe("list");

    act(() => {
      useUserPreferencesStore.getState().setViewMode("board");
    });
    expect(useUserPreferencesStore.getState().viewMode).toBe("board");
  });
});
