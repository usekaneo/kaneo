import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { SignInForm } from "@/components/auth/sign-in-form";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  reset: vi.fn(),
  search: {} as { token?: string; error?: string },
  config: { hasSmtp: true, disableLoginForm: false },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useSearch: () => mocks.search,
  Link: ({ children, to, ...props }: { children?: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: mocks.request,
    resetPassword: mocks.reset,
  },
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: mocks.config, isLoading: false, isError: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/auth/layout", () => ({
  AuthLayout: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/auth/turnstile", () => ({
  Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify("captcha-token")}>
      Solve CAPTCHA
    </button>
  ),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-key");
const { Route: forgotRoute } = await import("./forgot-password");
const { Route: resetRoute } = await import("./reset-password");
const ForgotPassword = (forgotRoute as unknown as { component: ComponentType })
  .component;
const ResetPassword = (resetRoute as unknown as { component: ComponentType })
  .component;
afterAll(() => vi.unstubAllEnvs());
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockResolvedValue({ error: null });
  mocks.reset.mockResolvedValue({ error: null });
  mocks.search = { token: "reset-token" };
  mocks.config = { hasSmtp: true, disableLoginForm: false };
});

function submitPasswords(password = "new-password", confirmation = password) {
  fireEvent.change(screen.getByLabelText("auth:passwordReset.newPassword"), {
    target: { value: password },
  });
  fireEvent.change(
    screen.getByLabelText("auth:passwordReset.confirmPassword"),
    { target: { value: confirmation } },
  );
  fireEvent.submit(
    screen
      .getByLabelText("auth:passwordReset.newPassword")
      .closest("form") as HTMLFormElement,
  );
}
function submitEmail() {
  fireEvent.change(screen.getByLabelText("auth:forms.email"), {
    target: { value: "reset@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Solve CAPTCHA" }));
  fireEvent.click(
    screen.getByRole("button", { name: "auth:passwordReset.sendLink" }),
  );
}

describe("password recovery", () => {
  it("shows the login link only when password reset is available", () => {
    const { rerender } = render(<SignInForm />);
    expect(
      screen.queryByRole("link", { name: "auth:passwordReset.forgotPassword" }),
    ).toBeNull();
    rerender(<SignInForm canResetPassword />);
    expect(
      screen.getByRole("link", { name: "auth:passwordReset.forgotPassword" }),
    ).toHaveAttribute("href", "/auth/forgot-password");
  });

  it("requests a link with CAPTCHA and confirms without disclosing account existence", async () => {
    render(<ForgotPassword />);
    expect(
      screen.getByRole("button", { name: "auth:passwordReset.sendLink" }),
    ).toBeDisabled();
    submitEmail();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "auth:passwordReset.sent",
      ),
    );
    expect(mocks.request).toHaveBeenCalledWith(
      {
        email: "reset@example.com",
        redirectTo: `${window.location.origin}/auth/reset-password`,
      },
      { headers: { "x-turnstile-token": "captcha-token" } },
    );
  });

  it("allows retry after a network failure with a fresh CAPTCHA", async () => {
    mocks.request.mockRejectedValueOnce(new Error("Network failed"));
    render(<ForgotPassword />);
    submitEmail();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "auth:passwordReset.requestError",
      ),
    );
    expect(
      screen.getByRole("button", { name: "auth:passwordReset.sendLink" }),
    ).toBeDisabled();
    submitEmail();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "auth:passwordReset.sent",
      ),
    );
  });

  it.each([
    { hasSmtp: false, disableLoginForm: false },
    { hasSmtp: true, disableLoginForm: true },
  ])("blocks reset requests for unavailable configuration %j", (config) => {
    mocks.config = config;
    render(<ForgotPassword />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "auth:passwordReset.unavailable",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each([{}, { error: "INVALID_TOKEN" }])(
    "offers another link when the URL cannot be used %j",
    (search) => {
      mocks.search = search;
      render(<ResetPassword />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "auth:passwordReset.invalidLink",
      );
      expect(
        screen.getByRole("link", { name: "auth:passwordReset.requestNewLink" }),
      ).toHaveAttribute("href", "/auth/forgot-password");
      expect(mocks.reset).not.toHaveBeenCalled();
    },
  );

  it("validates password length and confirmation before submitting", () => {
    render(<ResetPassword />);
    submitPasswords("short");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "auth:passwordReset.passwordLength",
    );
    submitPasswords("new-password", "different-password");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "auth:passwordReset.passwordMismatch",
    );
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("submits the token and offers sign-in on success", async () => {
    render(<ResetPassword />);
    submitPasswords();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "auth:passwordReset.success",
      ),
    );
    expect(mocks.reset).toHaveBeenCalledWith({
      newPassword: "new-password",
      token: "reset-token",
    });
    expect(
      screen.queryByLabelText("auth:passwordReset.newPassword"),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "auth:passwordReset.backToSignIn" }),
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("handles a token that expires before submission", async () => {
    mocks.reset.mockResolvedValue({ error: { code: "INVALID_TOKEN" } });
    render(<ResetPassword />);
    submitPasswords();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "auth:passwordReset.invalidLink",
      ),
    );
    expect(
      screen.queryByLabelText("auth:passwordReset.newPassword"),
    ).toBeNull();
  });

  it("keeps the form usable after a reset network error", async () => {
    mocks.reset.mockRejectedValueOnce(new Error("Network failed"));
    render(<ResetPassword />);
    submitPasswords();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "auth:passwordReset.resetError",
      ),
    );
    submitPasswords();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "auth:passwordReset.success",
      ),
    );
  });
});
