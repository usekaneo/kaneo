import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InvitationLinkField from "./invitation-link-field";

const copyToClipboard = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("@/lib/copy-to-clipboard", () => ({
  copyToClipboard: (text: string) => copyToClipboard(text),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (msg: string) => success(msg),
    error: (msg: string) => error(msg),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InvitationLinkField", () => {
  it("shows the full accept URL so it can be read and copied by hand", () => {
    render(<InvitationLinkField invitationId="inv-1" />);

    expect(screen.getByRole("textbox")).toHaveValue(
      `${window.location.origin}/invitation/accept/inv-1`,
    );
  });

  it("copies the link and confirms it", async () => {
    copyToClipboard.mockResolvedValue(true);
    render(<InvitationLinkField invitationId="inv-1" />);

    fireEvent.click(screen.getByRole("button"));

    expect(copyToClipboard).toHaveBeenCalledWith(
      `${window.location.origin}/invitation/accept/inv-1`,
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("team:invitations.linkCopied"),
    );
    expect(screen.getByRole("button")).toHaveTextContent(
      "team:invitations.linkCopied",
    );
  });

  it("selects the input and tells the user to copy by hand when copying fails", async () => {
    copyToClipboard.mockResolvedValue(false);
    render(<InvitationLinkField invitationId="inv-1" />);

    fireEvent.click(screen.getByRole("button"));

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("team:invitations.copyFailed"),
    );
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });
});
