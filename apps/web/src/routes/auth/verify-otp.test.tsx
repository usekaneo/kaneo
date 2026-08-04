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

const emailOtp = vi.fn();
const push = vi.fn();

let search: {
  email: string;
  invitationId?: string;
  redirect?: string;
} = { email: "invitee@kaneo.test" };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useRouter: () => ({ history: { push } }),
  useSearch: () => search,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      emailOtp: (
        body: { email: string; otp: string },
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

afterEach(() => {
  cleanup();
  emailOtp.mockReset();
  push.mockReset();
  search = { email: "invitee@kaneo.test" };
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

  it("sends no invitation header when the visitor arrived without one", async () => {
    submitCode();

    await waitFor(() => expect(emailOtp).toHaveBeenCalledTimes(1));
    expect(emailOtp).toHaveBeenCalledWith(
      { email: "invitee@kaneo.test", otp: "123456" },
      undefined,
    );
  });
});
