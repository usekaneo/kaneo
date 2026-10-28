import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { CustomFieldToggles } from "./custom-field-toggles";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({
    default: () => ({
      data: [
        { id: "points", name: "Story points", type: "number" },
        { id: "customer", name: "Customer", type: "text" },
      ],
    }),
  }),
);

beforeEach(() => {
  useUserPreferencesStore.setState({ hiddenCardFieldIds: [] });
});

afterEach(() => {
  cleanup();
});

describe("CustomFieldToggles", () => {
  it("hides and shows a field on cards, and reset shows it again", () => {
    render(<CustomFieldToggles projectId="project-1" />);
    const points = screen.getByRole("button", { name: "Story points" });
    expect(points).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(points);
    expect(useUserPreferencesStore.getState().hiddenCardFieldIds).toEqual([
      "points",
    ]);
    expect(points).toHaveAttribute("aria-pressed", "false");

    useUserPreferencesStore.getState().resetDisplayPreferences();
    expect(useUserPreferencesStore.getState().hiddenCardFieldIds).toEqual([]);
  });
});
