import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "./sign-up-form";

const mockPush = vi.fn();
const mockSignUpEmail = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      push: (...args: unknown[]) => mockPush(...args),
    },
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: {
      email: (...args: unknown[]) => mockSignUpEmail(...args),
    },
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SignUpForm invite flow", () => {
  afterEach(() => {
    cleanup();
    mockPush.mockReset();
    mockSignUpEmail.mockReset();
  });

  it("locks email when invitationId and defaultEmail are provided", () => {
    render(
      <SignUpForm invitationId="inv-1" defaultEmail="guest@example.com" />,
    );

    const emailInput = screen.getByDisplayValue("guest@example.com");
    expect(emailInput).toHaveAttribute("readonly");
  });

  it("sends x-invitation-id and redirects to accept page on success", async () => {
    mockSignUpEmail.mockResolvedValue({ data: {}, error: null });

    render(
      <SignUpForm invitationId="inv-1" defaultEmail="guest@example.com" />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("auth:signUpForm.namePlaceholder"),
      {
        target: { value: "Guest User" },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText("auth:signUpForm.setPasswordPlaceholder"),
      {
        target: { value: "password123" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "auth:signUpForm.createAccountAndContinue",
      }),
    );

    await waitFor(() => {
      expect(mockSignUpEmail).toHaveBeenCalled();
    });

    expect(mockSignUpEmail).toHaveBeenCalledWith(
      {
        email: "guest@example.com",
        name: "Guest User",
        password: "password123",
      },
      {
        headers: {
          "x-invitation-id": "inv-1",
        },
      },
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/invitation/accept/inv-1");
    });
  });
});
