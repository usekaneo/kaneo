import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "./sign-in";

const socialSignIn = vi.fn();
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => navigate,
  useSearch: () => ({}),
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({
    data: {
      hasCustomOAuth: true,
      hasGoogleSignIn: false,
      hasGithubSignIn: false,
      hasDiscordSignIn: false,
      hasGuestAccess: false,
      disableLoginForm: true,
    },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/queries/instance/use-instance-status", () => ({
  default: () => ({
    data: { hasUsers: true },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getLastUsedLoginMethod: () => null,
    signIn: {
      social: (...args: unknown[]) => socialSignIn(...args),
      anonymous: vi.fn(),
    },
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SignIn = (Route as unknown as { component: ComponentType }).component;

beforeEach(() => {
  socialSignIn.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  cleanup();
  socialSignIn.mockReset();
  navigate.mockReset();
});

describe("SignIn custom OAuth", () => {
  it("dispatches the custom social-provider payload with a callback and error URL", async () => {
    render(<SignIn />);

    fireEvent.click(
      screen.getByRole("button", { name: "auth:signIn.continueWithOidc" }),
    );

    await vi.waitFor(() => expect(socialSignIn).toHaveBeenCalledTimes(1));
    expect(socialSignIn).toHaveBeenCalledWith({
      provider: "custom",
      callbackURL: expect.stringContaining("/dashboard"),
      errorCallbackURL: expect.stringContaining("/auth/sign-in"),
    });
  });

  it("surfaces the OIDC error and re-enables the button when the dispatch fails", async () => {
    socialSignIn.mockResolvedValue({
      data: null,
      error: { message: "provider unreachable" },
    });
    const { toast } = await import("@/lib/toast");

    render(<SignIn />);

    fireEvent.click(
      screen.getByRole("button", { name: "auth:signIn.continueWithOidc" }),
    );

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("provider unreachable"),
    );
    expect(
      screen.getByRole("button", { name: "auth:signIn.continueWithOidc" }),
    ).not.toBeDisabled();
  });
});
