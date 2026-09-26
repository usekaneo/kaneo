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

const m = vi.hoisted(() => ({
  anonymous: vi.fn(),
  social: vi.fn(),
  oauth2: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: m, getLastUsedLoginMethod: () => null },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => ({}),
  useNavigate: () => m.navigate,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({
    data: {
      hasGuestAccess: true,
      hasGithubSignIn: true,
      hasCustomOAuth: true,
      customOAuthAutoLogin: true,
    },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/queries/instance/use-instance-status", () => ({
  default: () => ({
    data: { hasUsers: true, hasAdmin: true },
    isLoading: false,
  }),
}));
vi.mock("@/components/auth/layout", () => ({
  AuthLayout: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/auth/sign-up-form", () => ({ SignUpForm: () => null }));
vi.mock("@/components/auth/sign-in-form", () => ({ SignInForm: () => null }));
vi.mock("@/components/auth/toggle", () => ({ AuthToggle: () => null }));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/auth/turnstile", () => ({
  Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify("fresh-token")}>
      Solve CAPTCHA
    </button>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-sitekey");
const { Route: signin } = await import("./sign-in");
const { Route: signup } = await import("./sign-up");
afterAll(() => vi.unstubAllEnvs());
afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [m.anonymous, m.social, m.oauth2])
    mock.mockResolvedValue({ error: { message: "Retry" } });
});
describe.each([
  ["sign-in", signin],
  ["sign-up", signup],
] as const)("%s CAPTCHA submission", (_name, route) => {
  it.each([
    ["auth:signUp.continueAsGuest", "anonymous"],
    ["auth:signIn.continueWithGithub", "social"],
    ["auth:signIn.continueWithOidc", "oauth2"],
  ] as const)(
    "sends the token and requires a fresh one after %s fails",
    async (label, method) => {
      const Page = route.options.component as ComponentType;
      render(<Page />);
      expect(m.oauth2).not.toHaveBeenCalled(); // Auto-login cannot bypass CAPTCHA.
      const button = screen.getByRole("button", { name: label });
      expect(button).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Solve CAPTCHA" }));
      fireEvent.click(button);
      await waitFor(() => expect(m[method]).toHaveBeenCalledTimes(1));
      expect(m[method].mock.calls[0]?.[1]).toEqual({
        headers: { "x-turnstile-token": "fresh-token" },
      });
      await waitFor(() => expect(button).toBeDisabled());
      expect(
        screen.getByRole("button", { name: "Solve CAPTCHA" }),
      ).toBeInTheDocument();
    },
  );
});
