import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ApiKeysSettings } from "./api-keys-settings";

type TestKey = {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: string;
  expiresAt: string | null;
};

const m = vi.hoisted(() => ({
  keys: [] as TestKey[],
  isPending: false,
  create: vi.fn(),
  remove: vi.fn(),
  copy: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/format", () => ({
  formatDateMedium: () => "Sep 2, 2026",
}));
vi.mock("@/hooks/queries/use-get-api-keys", () => ({
  default: () => ({
    data: m.isPending ? undefined : m.keys,
    isPending: m.isPending,
    isError: false,
  }),
}));
vi.mock("@/hooks/mutations/api-key/use-create-api-key", () => ({
  default: () => ({ mutateAsync: m.create, isPending: false }),
}));
vi.mock("@/hooks/mutations/api-key/use-delete-api-key", () => ({
  default: () => ({ mutateAsync: m.remove, isPending: false }),
}));
vi.mock("@/lib/copy-to-clipboard", () => ({
  copyToClipboard: (text: string) => m.copy(text),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));

const activeKey: TestKey = {
  id: "cli",
  name: "Kaneo CLI",
  start: "kn_8f2a",
  createdAt: "2026-09-02T00:00:00Z",
  expiresAt: null,
};
const expiredKey: TestKey = {
  id: "deploy",
  name: "Deploy script",
  start: "kn_3d9e",
  createdAt: "2026-08-04T00:00:00Z",
  expiresAt: "2026-09-03T00:00:00Z",
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  m.keys = [activeKey, expiredKey];
  m.isPending = false;
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("API keys list", () => {
  it("shows the key prefix, expiry state and an expired badge only on expired keys", () => {
    render(<ApiKeysSettings />);
    expect(screen.getByText("Kaneo CLI")).toBeInTheDocument();
    expect(screen.getByText("kn_8f2a…")).toBeInTheDocument();
    expect(
      screen.getAllByText(/settings:apiKey\.row\.neverExpires/),
    ).toHaveLength(1);
    expect(screen.getAllByText(/settings:apiKey\.row\.expired$/)).toHaveLength(
      1,
    );
    expect(
      screen.getAllByText("settings:apiKey.row.expiredBadge"),
    ).toHaveLength(1);
  });

  it("shows skeleton rows while loading and an empty state with a create action", () => {
    m.isPending = true;
    const { unmount } = render(<ApiKeysSettings />);
    expect(screen.getAllByTestId("settings-row-skeleton")).toHaveLength(2);
    unmount();

    m.isPending = false;
    m.keys = [];
    render(<ApiKeysSettings />);
    expect(
      screen.getByText("settings:developerPage.emptyTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "settings:developerPage.newKey" }),
    ).toHaveLength(2);
  });

  it("deletes a key only after confirmation", async () => {
    m.remove.mockResolvedValue({ success: true });
    render(<ApiKeysSettings />);
    const [firstMenu] = screen.getAllByRole("button", {
      name: "settings:apiKey.row.actions",
    });
    fireEvent.click(firstMenu);
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:apiKey.table.delete",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:apiKey.table.delete",
      }),
    );
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith("cli"));
    expect(m.success).toHaveBeenCalledWith(
      "settings:apiKey.table.toastDeleted",
      { icon: expect.anything() },
    );
  });
});

describe("creating API keys", () => {
  it("validates the name, sends the chosen expiry and keeps Done disabled until the key is copied", async () => {
    m.create.mockResolvedValue({ key: "kn_secret", name: "Laptop" });
    m.copy.mockResolvedValue(true);
    render(<ApiKeysSettings />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:developerPage.newKey" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", {
        name: "settings:apiKey.createDialog.expiration30d",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(
      within(dialog).getByLabelText("settings:apiKey.createDialog.nameLabel"),
      { target: { value: "ab" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:apiKey.createDialog.create",
      }),
    );
    expect(
      await within(dialog).findByText(
        "settings:apiKey.createDialog.validation.nameShort",
      ),
    ).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();

    fireEvent.change(
      within(dialog).getByLabelText("settings:apiKey.createDialog.nameLabel"),
      { target: { value: "Laptop" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:apiKey.createDialog.expirationNever",
      }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:apiKey.createDialog.create",
      }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        name: "Laptop",
        expiresIn: null,
      }),
    );

    expect(
      await screen.findByText("settings:apiKey.createdModal.title"),
    ).toBeInTheDocument();
    expect(screen.getByText("kn_secret")).toBeInTheDocument();
    const done = screen.getByRole("button", {
      name: "settings:apiKey.createdModal.done",
    });
    expect(done).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:apiKey.createdModal.copy" }),
    );
    await waitFor(() => expect(m.copy).toHaveBeenCalledWith("kn_secret"));
    await waitFor(() => expect(done).toBeEnabled());
    expect(
      screen.getByRole("button", {
        name: "settings:apiKey.createdModal.copied",
      }),
    ).toBeInTheDocument();
  });

  it("keeps Done disabled and reports an error when copying fails", async () => {
    m.create.mockResolvedValue({ key: "kn_secret", name: "Laptop" });
    m.copy.mockResolvedValue(false);
    render(<ApiKeysSettings />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:developerPage.newKey" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText("settings:apiKey.createDialog.nameLabel"),
      { target: { value: "Laptop" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:apiKey.createDialog.create",
      }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        name: "Laptop",
        expiresIn: 2_592_000,
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:apiKey.createdModal.copy",
      }),
    );
    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith(
        "settings:apiKey.createdModal.copyError",
      ),
    );
    expect(
      screen.getByRole("button", { name: "settings:apiKey.createdModal.done" }),
    ).toBeDisabled();
  });
});
