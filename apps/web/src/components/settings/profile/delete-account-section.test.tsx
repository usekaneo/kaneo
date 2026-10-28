import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { DeleteAccountSection } from "./delete-account-section";

const m = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  navigate: vi.fn(),
  clear: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => m.navigate,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: m.clear }),
}));
vi.mock("@/hooks/mutations/use-delete-account", () => ({
  SESSION_TOO_OLD: "SESSION_TOO_OLD",
  default: () => ({ mutateAsync: m.deleteAccount, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));

function openDialog() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:informationPage.deleteAccount.title",
    }),
  );
}

function confirmButton() {
  return screen.findByRole("button", {
    name: "settings:informationPage.deleteAccount.confirm",
  });
}

describe("DeleteAccountSection", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    m.deleteAccount.mockResolvedValue(undefined);
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });

  it("keeps the confirm disabled until the email is typed", async () => {
    render(<DeleteAccountSection email="jo@example.com" />);
    openDialog();

    expect(await confirmButton()).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText(
        "settings:informationPage.deleteAccount.confirmLabel",
      ),
      { target: { value: "JO@example.com" } },
    );

    expect(await confirmButton()).toBeEnabled();
    fireEvent.click(await confirmButton());

    await waitFor(() => expect(m.deleteAccount).toHaveBeenCalled());
    expect(m.clear).toHaveBeenCalled();
    expect(m.navigate).toHaveBeenCalledWith({ to: "/auth/sign-in" });
  });

  it("explains a session that is too old to delete the account", async () => {
    m.deleteAccount.mockRejectedValue(new Error("SESSION_TOO_OLD"));
    render(<DeleteAccountSection email="jo@example.com" />);
    openDialog();

    fireEvent.change(
      screen.getByLabelText(
        "settings:informationPage.deleteAccount.confirmLabel",
      ),
      { target: { value: "jo@example.com" } },
    );
    fireEvent.click(await confirmButton());

    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith(
        "settings:informationPage.deleteAccount.sessionTooOld",
      ),
    );
    expect(m.navigate).not.toHaveBeenCalled();
  });
});
