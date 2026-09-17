import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render as rtlRender,
  screen,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingFlow } from "./onboarding-flow";

const config = vi.fn();
const authUser = vi.fn();
const refetchUser = vi.fn(async () => {});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => vi.fn(),
}));

// Renders a router Link, which needs a router context this test has no reason
// to build.
vi.mock("@/components/common/logo", () => ({
  Logo: () => null,
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => config(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: vi.fn() } },
}));

vi.mock("@/hooks/queries/workspace/use-create-workspace", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  // A fresh function identity per call, as the real provider produces: it
  // builds the context value inline, so every provider render yields a new
  // refetchUser. A stable mock here cannot reproduce the refetch loop.
  default: () => ({
    user: authUser(),
    refetchUser: async () => {
      await refetchUser();
    },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

beforeEach(() => {
  authUser.mockReturnValue({ id: "u1", name: "Sam", role: "user" });
  config.mockReturnValue({
    data: { disableWorkspaceCreation: false },
    isPending: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// A real client rather than a mocked one: the component reaches react-query
// through hooks this test does not stub.
function render(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrap = (node: ReactNode) =>
    createElement(QueryClientProvider, { client }, node) as never;
  const result = rtlRender(wrap(ui));
  // RTL's own rerender drops the wrapper, which the component needs.
  return {
    ...result,
    rerender: (next: ReactNode) => result.rerender(wrap(next)),
  };
}

const creationForm = () =>
  screen.queryByText("auth:onboarding.createWorkspaceTitle");
const restricted = () => screen.queryByText("auth:onboarding.restrictedTitle");

// Nothing decides until the one-shot role refresh settles.
const settled = () => act(async () => {});

describe("OnboardingFlow", () => {
  it("offers the creation form when anyone may create a workspace", async () => {
    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("explains the restriction instead of offering a form that would fail", async () => {
    config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });

    render(<OnboardingFlow />);
    await settled();

    // The API refuses creation for non-admins, so offering the form here only
    // produces an error at submit time.
    expect(restricted()).toBeInTheDocument();
    expect(creationForm()).not.toBeInTheDocument();
    // Reaching this screen with an invitation waiting is possible, so it has
    // to offer a route back to it.
    expect(
      screen.getByText("auth:onboarding.restrictedCheckInvitations"),
    ).toBeInTheDocument();
  });

  it("still offers the form to an instance admin when creation is restricted", async () => {
    config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    authUser.mockReturnValue({ id: "u1", name: "Sam", role: "admin" });

    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("does not make an instance admin wait for the config", async () => {
    // The setting cannot restrict an admin, so its value cannot change what
    // they are shown. Waiting would delay a form they always get.
    config.mockReturnValue({ data: undefined, isPending: true });
    authUser.mockReturnValue({ id: "u1", name: "Sam", role: "admin" });

    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("still decides when the role refresh fails", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    refetchUser.mockRejectedValueOnce(new Error("network"));

    render(<OnboardingFlow />);
    await settled();
    await settled();

    // The cached role stands, the screen resolves, and the failure does not
    // escape as a global error.
    expect(creationForm()).toBeInTheDocument();
    expect(unhandled).not.toHaveBeenCalled();
    process.off("unhandledRejection", unhandled);
  });

  it("claims nothing while the config is still loading", async () => {
    // `undefined` is the pending state. Showing the restriction here would
    // flash a false statement before a working form resolves, and showing the
    // form would invite a submit that fails.
    config.mockReturnValue({ data: undefined, isPending: true });

    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).not.toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("falls back to the form when the config request fails", async () => {
    // Settled with no data is an error, not a restriction. Claiming a
    // restriction here would be untrue, and the API still has the final say.
    config.mockReturnValue({ data: undefined, isPending: false });

    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("re-reads the role, which the session may report stale", async () => {
    render(<OnboardingFlow />);
    await settled();

    // The first admin of an instance is promoted after the session is cached.
    expect(refetchUser).toHaveBeenCalled();
  });

  it("re-reads the role only once, however often the provider rerenders", async () => {
    const { rerender } = render(<OnboardingFlow />);
    await settled();

    // The provider builds refetchUser inline, so it is a new function on each
    // of its renders and refetching rerenders it. Keying the effect on that
    // identity alone would refetch forever.
    refetchUser.mockClear();
    rerender(<OnboardingFlow />);
    await settled();
    rerender(<OnboardingFlow />);
    await settled();

    expect(refetchUser).not.toHaveBeenCalled();
  });
});
