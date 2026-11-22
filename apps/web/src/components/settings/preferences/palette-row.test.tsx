import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { PaletteRow } from "./palette-row";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PaletteRow", () => {
  afterEach(() => {
    cleanup();
    useUserPreferencesStore.setState({ palette: "kaneo" });
  });

  it("offers both palettes and applies the selected one", () => {
    useUserPreferencesStore.setState({ palette: "kaneo" });
    render(<PaletteRow />);

    const kaneo = screen.getByRole("radio", {
      name: "settings:preferencesPage.paletteKaneo",
    });
    const modern = screen.getByRole("radio", {
      name: "settings:preferencesPage.paletteModern",
    });
    expect(kaneo).toBeChecked();
    expect(modern).not.toBeChecked();
    expect(document.querySelectorAll("svg.lucide-check")).toHaveLength(1);

    fireEvent.click(modern);
    expect(useUserPreferencesStore.getState().palette).toBe("modern");
    expect(document.querySelectorAll("svg.lucide-check")).toHaveLength(1);
    expect(
      document.querySelectorAll("svg.lucide-check")[0].closest("label")
        ?.textContent,
    ).toContain("settings:preferencesPage.paletteModern");
  });
});
