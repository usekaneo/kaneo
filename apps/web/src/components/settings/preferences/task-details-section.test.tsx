import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { TaskDetailsSection } from "./task-details-section";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("TaskDetailsSection", () => {
  afterEach(cleanup);

  it("toggles a detail and resets them all", () => {
    useUserPreferencesStore.setState({ showPriority: true });
    render(<TaskDetailsSection />);

    const priority = screen.getByRole("switch", {
      name: "settings:preferencesPage.priority",
    });
    fireEvent.click(priority);
    expect(useUserPreferencesStore.getState().showPriority).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.reset" }),
    );
    expect(useUserPreferencesStore.getState().showPriority).toBe(true);
  });
});
