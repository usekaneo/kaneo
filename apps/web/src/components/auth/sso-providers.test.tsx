import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GetConfigResponse } from "@/fetchers/config/get-config";
import { SSOProviders } from "./sso-providers";

const socialSignIn = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) => socialSignIn(...args),
    },
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const config = {
  hasGoogleSignIn: true,
  hasGithubSignIn: true,
  hasDiscordSignIn: true,
  hasCustomOAuth: true,
} as GetConfigResponse;

beforeEach(() => {
  socialSignIn.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  cleanup();
  socialSignIn.mockReset();
});

describe("SSOProviders", () => {
  it("dispatches the custom social-provider payload for OIDC sign-in", async () => {
    render(
      <SSOProviders
        config={config}
        callbackURL="https://kaneo.test/dashboard"
        errorCallbackURL="https://kaneo.test/auth/sign-in"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "auth:signIn.continueWithOidc",
      }),
    );

    await vi.waitFor(() => expect(socialSignIn).toHaveBeenCalledTimes(1));
    expect(socialSignIn).toHaveBeenCalledWith({
      provider: "custom",
      callbackURL: "https://kaneo.test/dashboard",
      errorCallbackURL: "https://kaneo.test/auth/sign-in",
    });
  });

  it("dispatches the built-in social-provider payload for Google sign-in", async () => {
    render(
      <SSOProviders
        config={config}
        callbackURL="https://kaneo.test/dashboard"
        errorCallbackURL="https://kaneo.test/auth/sign-in"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /auth:signIn\.continueWithGoogle/,
      }),
    );

    await vi.waitFor(() => expect(socialSignIn).toHaveBeenCalledTimes(1));
    expect(socialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "https://kaneo.test/dashboard",
      errorCallbackURL: "https://kaneo.test/auth/sign-in",
    });
  });

  it("surfaces the error toast when the custom OAuth dispatch fails", async () => {
    const { toast } = await import("@/lib/toast");
    socialSignIn.mockResolvedValue({
      data: null,
      error: { message: "provider unreachable" },
    });

    render(
      <SSOProviders
        config={config}
        callbackURL="https://kaneo.test/dashboard"
        errorCallbackURL="https://kaneo.test/auth/sign-in"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "auth:signIn.continueWithOidc",
      }),
    );

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("provider unreachable"),
    );
  });
});
