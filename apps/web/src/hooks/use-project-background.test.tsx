import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectBackground } from "./use-project-background";

const preferences = vi.hoisted(() => ({ showProjectBackgrounds: true }));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => preferences,
}));

describe("useProjectBackground", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    preferences.showProjectBackgrounds = true;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a versioned API URL for board backgrounds", () => {
    const { result } = renderHook(() =>
      useProjectBackground({
        projectId: "project-1",
        backgroundVersion: "version with spaces",
        viewMode: "board",
      }),
    );

    expect(result.current).toBe(
      "https://api.example.test/api/project/project-1/background?v=version%20with%20spaces",
    );
  });

  it.each([
    { projectId: undefined, backgroundVersion: "v1", viewMode: "board" },
    { projectId: "project-1", backgroundVersion: null, viewMode: "board" },
    { projectId: "project-1", backgroundVersion: "v1", viewMode: "list" },
  ] as const)("returns null when the background is not applicable", (props) => {
    const { result } = renderHook(() => useProjectBackground(props));

    expect(result.current).toBeNull();
  });

  it("reacts to the background visibility preference", () => {
    const { result, rerender } = renderHook(() =>
      useProjectBackground({
        projectId: "project-1",
        backgroundVersion: "v1",
        viewMode: "board",
      }),
    );

    preferences.showProjectBackgrounds = false;
    rerender();

    expect(result.current).toBeNull();
  });
});
