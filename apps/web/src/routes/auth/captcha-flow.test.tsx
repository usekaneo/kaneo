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
  email: vi.fn(),
  navigate: vi.fn(),
  getConfig: vi.fn(),
  config: {} as Record<string, unknown>,
}));
vi.mock("@/fetchers/config/get-config", () => ({ getConfig: m.getConfig }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: m,
    signUp: { email: vi.fn() },
    emailOtp: { sendVerificationOtp: vi.fn() },
    getLastUsedLoginMethod: () => null,
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => ({}),
  useNavigate: () => m.navigate,
  useRouter: () => ({ history: { push: vi.fn() } }),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: m.config, isLoading: false }),
}));
vi.mock("@/hooks/queries/instance/use-instance-status", () => ({
  default: () => ({
    data: { hasUsers: true, hasAdmin: true },
    isLoading: false,
  }),
}));
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
  m.config = {
    hasSmtp: false,
    hasGuestAccess: true,
    hasGithubSignIn: true,
    hasCustomOAuth: true,
    customOAuthAutoLogin: true,
  };
  for (const mock of [m.anonymous, m.social, m.oauth2, m.email])
    mock.mockResolvedValue({ error: { message: "Retry" } });
});

describe("sign-up route", () => {
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

  it("asks for a name and email, without a password, when email codes are on", () => {
    m.config = { ...m.config, hasSmtp: true };
    const Page = signup.options.component as ComponentType;
    render(<Page />);
    expect(screen.getByLabelText("auth:forms.name")).toBeInTheDocument();
    expect(screen.getByLabelText("auth:forms.email")).toBeInTheDocument();
    expect(screen.queryByLabelText("auth:forms.password")).toBeNull();
  });
});

describe.each([
  ["sign-in", signin],
  ["sign-up", signup],
] as const)("%s CAPTCHA submission", (_name, route) => {
  it.each([
    ["auth:signUp.continueAsGuest", "anonymous"],
    ["auth:providers.github", "social"],
    ["auth:providers.sso", "oauth2"],
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

describe("sign-in password form", () => {
  it("sends the CAPTCHA token with a password sign-in", async () => {
    const Page = signin.options.component as ComponentType;
    render(<Page />);
    fireEvent.change(screen.getByLabelText("auth:forms.email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("auth:forms.password"), {
      target: { value: "long-test-password" },
    });
    const submit = screen.getByRole("button", {
      name: "auth:signIn.submitPassword",
    });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Solve CAPTCHA" }));
    fireEvent.click(submit);
    await waitFor(() => expect(m.email).toHaveBeenCalledTimes(1));
    expect(m.email).toHaveBeenCalledWith(
      { email: "person@example.com", password: "long-test-password" },
      { headers: { "x-turnstile-token": "fresh-token" } },
    );
  });
});
