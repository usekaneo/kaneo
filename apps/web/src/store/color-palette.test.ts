import { describe, expect, it } from "vite-plus/test";
import { isColorPalette, normalizePalette } from "./color-palette";
import { useUserPreferencesStore } from "./user-preferences";

describe("color palette preference", () => {
  it("accepts the two known palettes", () => {
    expect(isColorPalette("kaneo")).toBe(true);
    expect(isColorPalette("modern")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isColorPalette("neon")).toBe(false);
    expect(isColorPalette(undefined)).toBe(false);
  });

  it("falls back to kaneo for stored garbage", () => {
    expect(normalizePalette("neon")).toBe("kaneo");
    expect(normalizePalette(null)).toBe("kaneo");
    expect(normalizePalette("modern")).toBe("modern");
  });

  it("defaults to kaneo and persists a switch", () => {
    useUserPreferencesStore.setState({ palette: "kaneo" });
    expect(useUserPreferencesStore.getState().palette).toBe("kaneo");
    useUserPreferencesStore.getState().setPalette("modern");
    expect(useUserPreferencesStore.getState().palette).toBe("modern");
    useUserPreferencesStore.getState().setPalette("kaneo");
  });
});
