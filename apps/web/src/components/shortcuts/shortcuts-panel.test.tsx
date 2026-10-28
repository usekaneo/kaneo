import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { ShortcutsPanel } from "./shortcuts-panel";
import { useShortcutsPanelStore } from "./shortcuts-panel-store";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

beforeEach(() => {
  useShortcutsPanelStore.setState({ open: false });
});

afterEach(() => {
  cleanup();
});

const renderPanel = () =>
  render(
    <ShortcutTestWrapper>
      <ShortcutsPanel />
    </ShortcutTestWrapper>,
  );

const hasRow = (label: string) =>
  screen
    .queryAllByRole("listitem")
    .some((row) => row.textContent?.startsWith(label));

const search = () =>
  screen.getByLabelText("navigation:shortcuts.searchPlaceholder");

describe("ShortcutsPanel", () => {
  it("opens with ? and lists the catalog by section", async () => {
    renderPanel();
    fireEvent.keyDown(document.body, {
      key: "?",
      code: "Slash",
      shiftKey: true,
    });
    expect(
      await screen.findByText("navigation:shortcuts.categories.navigation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("navigation:shortcuts.items.goToInbox"),
    ).toBeInTheDocument();
  });

  it("filters by label and by key name", async () => {
    useShortcutsPanelStore.setState({ open: true });
    renderPanel();
    fireEvent.change(
      await screen.findByLabelText("navigation:shortcuts.searchPlaceholder"),
      {
        target: { value: "inbox" },
      },
    );
    expect(hasRow("navigation:shortcuts.items.goToInbox")).toBe(true);
    expect(hasRow("navigation:shortcuts.items.createTask")).toBe(false);

    fireEvent.change(search(), { target: { value: "ctrl" } });
    expect(hasRow("navigation:shortcuts.items.openCommandMenu")).toBe(true);
    expect(hasRow("navigation:shortcuts.items.createTask")).toBe(false);
  });

  it("clears the search on the first Escape and closes on the second", async () => {
    useShortcutsPanelStore.setState({ open: true });
    renderPanel();
    const input = await screen.findByLabelText(
      "navigation:shortcuts.searchPlaceholder",
    );
    fireEvent.change(input, { target: { value: "inbox" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await act(async () => {});
    expect(search()).toHaveValue("");
    expect(useShortcutsPanelStore.getState().open).toBe(true);

    fireEvent.keyDown(search(), { key: "Escape" });
    await act(async () => {});
    expect(useShortcutsPanelStore.getState().open).toBe(false);
  });
});
