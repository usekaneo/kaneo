import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordSettings } from "./change-password-settings";

const changePassword = vi.fn();
let accounts: Array<{ providerId: string }> | undefined = [];
let isError = false;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/queries/use-list-accounts", () => ({
  default: () => ({ data: accounts, isLoading: false, isError }),
}));

vi.mock("@/hooks/mutations/use-change-password", () => ({
  default: () => ({ mutateAsync: changePassword, isPending: false }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function fillField(placeholderKey: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholderKey), {
    target: { value },
  });
}

function submit() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:securityPage.submit" }),
  );
}

describe("ChangePasswordSettings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    changePassword.mockReset();
    changePassword.mockResolvedValue(undefined);
    accounts = [{ providerId: "credential" }];
    isError = false;
  });

  it("hides the form for an account with no password credential", () => {
    accounts = [{ providerId: "google" }];
    render(<ChangePasswordSettings />);

    expect(
      screen.getByText("settings:securityPage.noPassword.title"),
    ).toBeTruthy();
    expect(
      screen.queryByPlaceholderText(
        "settings:securityPage.newPasswordPlaceholder",
      ),
    ).toBeNull();
  });

  it("shows an error instead of the form when accounts fail to load", () => {
    accounts = undefined;
    isError = true;
    render(<ChangePasswordSettings />);

    expect(screen.getByText("common:error.messages.unknown")).toBeTruthy();
    expect(
      screen.queryByPlaceholderText(
        "settings:securityPage.newPasswordPlaceholder",
      ),
    ).toBeNull();
    expect(
      screen.queryByText("settings:securityPage.noPassword.title"),
    ).toBeNull();
  });

  it("shows the change-password form for a credential account", () => {
    render(<ChangePasswordSettings />);

    expect(
      screen.getByPlaceholderText(
        "settings:securityPage.currentPasswordPlaceholder",
      ),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "settings:securityPage.newPasswordPlaceholder",
      ),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "settings:securityPage.confirmPasswordPlaceholder",
      ),
    ).toBeTruthy();
  });

  it("blocks the submit when the confirmation does not match", async () => {
    render(<ChangePasswordSettings />);

    fillField("settings:securityPage.currentPasswordPlaceholder", "oldpass12");
    fillField("settings:securityPage.newPasswordPlaceholder", "newpass12");
    fillField(
      "settings:securityPage.confirmPasswordPlaceholder",
      "different12",
    );
    submit();

    expect(
      await screen.findByText("settings:securityPage.validation.mismatch"),
    ).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("blocks the submit when the new password equals the current one", async () => {
    render(<ChangePasswordSettings />);

    fillField("settings:securityPage.currentPasswordPlaceholder", "samepass12");
    fillField("settings:securityPage.newPasswordPlaceholder", "samepass12");
    fillField("settings:securityPage.confirmPasswordPlaceholder", "samepass12");
    submit();

    expect(
      await screen.findByText("settings:securityPage.validation.sameAsCurrent"),
    ).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("submits the current and new password when the form is valid", async () => {
    render(<ChangePasswordSettings />);

    fillField("settings:securityPage.currentPasswordPlaceholder", "oldpass12");
    fillField("settings:securityPage.newPasswordPlaceholder", "newpass12");
    fillField("settings:securityPage.confirmPasswordPlaceholder", "newpass12");
    submit();

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "oldpass12",
        newPassword: "newpass12",
      }),
    );
  });
});
