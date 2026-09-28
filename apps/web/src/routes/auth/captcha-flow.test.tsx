import { QueryClient } from "@tanstack/react-query";
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
} from "vite-plus/test";

const m = vi.hoisted(() => ({
  anonymous: vi.fn(),
  social: vi.fn(),
  oauth2: vi.fn(),
  navigate: vi.fn(),
  isCloud: false,
  getConfig: vi.fn(),
}));
vi.mock("@/fetchers/config/get-config", () => ({ getConfig: m.getConfig }));
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
      isCloud: m.isCloud,
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
  AuthLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="self-hosted-sign-up">{children}</div>
  ),
}));
vi.mock("@/components/auth/cloud-auth-layout", () => ({
  CloudAuthLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="cloud-sign-up">{children}</div>
  ),
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
  m.isCloud = false;
  for (const mock of [m.anonymous, m.social, m.oauth2])
    mock.mockResolvedValue({ error: { message: "Retry" } });
});
describe("sign-up layout", () => {
  it("still renders the route when config preloading fails", async () => {
    m.getConfig.mockRejectedValueOnce(new Error("offline"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const loader = signup.options.loader as (args: {
      context: { queryClient: QueryClient };
    }) => Promise<void>;
    await expect(loader({ context: { queryClient } })).resolves.toBeUndefined();
    expect(queryClient.getQueryState(["config"])?.status).toBe("error");
  });

  const Page = signup.options.component as ComponentType;

  it("uses the existing layout for a self-hosted instance", () => {
    render(<Page />);
    expect(screen.getByTestId("self-hosted-sign-up")).toBeInTheDocument();
  });

  it("uses the cloud layout only when the instance reports cloud mode", () => {
    m.isCloud = true;
    render(<Page />);
    expect(screen.getByTestId("cloud-sign-up")).toBeInTheDocument();
  });
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
