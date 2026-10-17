import {
  act,
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
import { Route } from "./verify-otp";

// The OTP input measures itself on mount, which jsdom cannot do.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

document.elementFromPoint = () => null;

const emailOtp = vi.fn();
const push = vi.fn();

let locationState: unknown = null;
let search: {
  email: string;
  invitationId?: string;
  redirect?: string;
} = { email: "invitee@kaneo.test" };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useLocation: () => ({ state: locationState }),
  useRouter: () => ({ history: { push } }),
  useSearch: () => search,
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      emailOtp: (
        body: { email: string; otp: string; name?: string },
        fetchOptions?: { headers: Record<string, string> },
      ) => emailOtp(body, fetchOptions),
    },
    emailOtp: { sendVerificationOtp: vi.fn() },
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const VerifyOtp = (Route as unknown as { component: ComponentType }).component;

function submitCode() {
  render(<VerifyOtp />);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "123456" },
  });
}

beforeEach(() => {
  emailOtp.mockResolvedValue({ data: {}, error: null });
});

afterEach(async () => {
  // input-otp schedules internal timers (0/10/50ms in password manager
  // detection; 0/2/5/6s in autofill checks) when the input focuses. The
  // short ones can fire after vitest tears down jsdom on a slow worker,
  // surfacing as an unhandled "window is not defined" error from a stale
  // setState. Drain inside act() so React flushes too. The 2/5/6s timers
  // are still cleared by the component's effect cleanup when it unmounts.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  cleanup();
  emailOtp.mockReset();
  push.mockReset();
  search = { email: "invitee@kaneo.test" };
  locationState = null;
});

// The ResizeObserver stub is installed at module scope, so restore it rather
// than leaking it into other test files sharing this worker.
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("VerifyOtp", () => {
  it("forwards the invitation so a first OTP sign-in can create the account", async () => {
    search = { email: "invitee@kaneo.test", invitationId: "invitation-1" };

    submitCode();

    await waitFor(() => expect(emailOtp).toHaveBeenCalledTimes(1));
    expect(emailOtp).toHaveBeenCalledWith(
      { email: "invitee@kaneo.test", otp: "123456" },
      { headers: { "x-invitation-id": "invitation-1" } },
    );
  });

  it("passes the name from the sign-up page so the new account keeps it", async () => {
    locationState = { signUpName: "New Person" };

    submitCode();

    await waitFor(() => expect(emailOtp).toHaveBeenCalledTimes(1));
    expect(emailOtp).toHaveBeenCalledWith(
      { email: "invitee@kaneo.test", otp: "123456", name: "New Person" },
      undefined,
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an expired code inline instead of signing in", async () => {
    emailOtp.mockResolvedValue({ data: null, error: { code: "OTP_EXPIRED" } });

    submitCode();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "auth:verifyOtp.expired",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("sends no invitation header when the visitor arrived without one", async () => {
    submitCode();

    await waitFor(() => expect(emailOtp).toHaveBeenCalledTimes(1));
    expect(emailOtp).toHaveBeenCalledWith(
      { email: "invitee@kaneo.test", otp: "123456" },
      undefined,
    );
  });
});
