import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { PriorityIconsRow } from "./priority-icons-row";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PriorityIconsRow", () => {
  afterEach(() => {
    cleanup();
    useUserPreferencesStore.setState({ priorityIconStyle: "marks" });
  });

  it("switches task priority icons to the classic chevrons and back", () => {
    useUserPreferencesStore.setState({ priorityIconStyle: "marks" });
    render(
      <>
        <PriorityIconsRow />
        <span data-testid="glyph">
          <PriorityGlyph priority="high" />
        </span>
      </>,
    );
    const glyph = screen.getByTestId("glyph");
    expect(glyph.querySelector("svg.lucide-chevrons-up")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /settings:preferencesPage.priorityIconsClassic/,
      }),
    );
    expect(useUserPreferencesStore.getState().priorityIconStyle).toBe(
      "classic",
    );
    expect(glyph.querySelector("svg.lucide-chevrons-up")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: /settings:preferencesPage.priorityIconsMarks/,
      }),
    );
    expect(useUserPreferencesStore.getState().priorityIconStyle).toBe("marks");
    expect(glyph.querySelector("svg.lucide-chevrons-up")).toBeNull();
  });
});
