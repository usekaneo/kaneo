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
import { ChangePasswordSettings } from "./change-password-settings";

const m = vi.hoisted(() => ({
  changePassword: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
let accounts: Array<{ providerId: string }> | undefined = [];
let isError = false;

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/queries/use-list-accounts", () => ({
  default: () => ({ data: accounts, isLoading: false, isError }),
}));

vi.mock("@/hooks/mutations/use-change-password", () => ({
  default: () => ({ mutateAsync: m.changePassword, isPending: false }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));

function openDialog() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:securityPage.changePassword",
    }),
  );
}

function fillField(placeholderKey: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholderKey), {
    target: { value },
  });
}

function submitButton() {
  return screen.getByRole("button", { name: "settings:securityPage.submit" });
}

describe("ChangePasswordSettings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    m.changePassword.mockResolvedValue(undefined);
    accounts = [{ providerId: "credential" }];
    isError = false;
  });

  it("explains why there is no password for an account without one", () => {
    accounts = [{ providerId: "google" }];
    render(<ChangePasswordSettings />);

    expect(
      screen.getByText("settings:securityPage.noPassword.title"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "settings:securityPage.changePassword",
      }),
    ).toBeNull();
  });

  it("shows an error instead of the action when accounts fail to load", () => {
    accounts = undefined;
    isError = true;
    render(<ChangePasswordSettings />);

    expect(screen.getByText("common:error.messages.unknown")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "settings:securityPage.changePassword",
      }),
    ).toBeNull();
    expect(
      screen.queryByText("settings:securityPage.noPassword.title"),
    ).toBeNull();
  });

  it("opens the dialog with labelled password fields and a disabled submit", async () => {
    render(<ChangePasswordSettings />);
    openDialog();

    expect(
      await screen.findByLabelText("settings:securityPage.currentPassword"),
    ).toHaveAttribute("type", "password");
    expect(
      screen.getByLabelText("settings:securityPage.newPassword"),
    ).toHaveAttribute("type", "password");
    expect(
      screen.getByLabelText("settings:securityPage.confirmPassword"),
    ).toHaveAttribute("type", "password");
    expect(submitButton()).toBeDisabled();
  });

  it("keeps the submit disabled when the confirmation does not match", async () => {
    render(<ChangePasswordSettings />);
    openDialog();

    fillField("settings:securityPage.currentPasswordPlaceholder", "oldpass12");
    fillField("settings:securityPage.newPasswordPlaceholder", "newpass12");
    fillField(
      "settings:securityPage.confirmPasswordPlaceholder",
      "different12",
    );

    expect(
      await screen.findByText("settings:securityPage.validation.mismatch"),
    ).toBeTruthy();
    expect(submitButton()).toBeDisabled();
    expect(m.changePassword).not.toHaveBeenCalled();
  });

  it("flags a new password that equals the current one", async () => {
    render(<ChangePasswordSettings />);
    openDialog();

    fillField("settings:securityPage.currentPasswordPlaceholder", "samepass12");
    fillField("settings:securityPage.newPasswordPlaceholder", "samepass12");

    expect(
      await screen.findByText("settings:securityPage.validation.sameAsCurrent"),
    ).toBeTruthy();
    expect(submitButton()).toBeDisabled();
  });

  it("submits a valid change, confirms it, and closes the dialog", async () => {
    render(<ChangePasswordSettings />);
    openDialog();

    fillField("settings:securityPage.currentPasswordPlaceholder", "oldpass12");
    fillField("settings:securityPage.newPasswordPlaceholder", "newpass12");
    fillField("settings:securityPage.confirmPasswordPlaceholder", "newpass12");

    await waitFor(() => expect(submitButton()).toBeEnabled());
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(m.changePassword).toHaveBeenCalledWith({
        currentPassword: "oldpass12",
        newPassword: "newpass12",
      }),
    );
    expect(m.success).toHaveBeenCalledWith(
      "settings:securityPage.updateSuccess",
      { icon: expect.anything() },
    );
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(
          "settings:securityPage.currentPasswordPlaceholder",
        ),
      ).toBeNull(),
    );
  });
});
