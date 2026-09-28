import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { OnboardingFlow } from "./onboarding-flow";

const navigate = vi.fn();
const createWorkspace = vi.fn();
const config = vi.fn();
const authUser = vi.fn();
const getSession = vi.fn();
const getBilling = vi.fn();
const inviteMember = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
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
  authClient: {
    organization: { setActive: vi.fn() },
    getSession: (options: unknown) => getSession(options),
  },
}));

vi.mock("@/fetchers/billing/get-billing", () => ({
  getBilling: (workspaceId: string) => getBilling(workspaceId),
}));

vi.mock("@/hooks/mutations/workspace-user/use-invite-workspace-user", () => ({
  default: () => ({ mutateAsync: inviteMember }),
}));

vi.mock("@/hooks/queries/workspace/use-create-workspace", () => ({
  default: () => ({ mutateAsync: createWorkspace, isPending: false }),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: authUser(), refetchUser: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

beforeEach(() => {
  createWorkspace.mockResolvedValue({ id: "workspace-1" });
  authUser.mockReturnValue({ id: "u1", name: "Sam", role: "user" });
  // Better Auth resolves with `{ data, error }` and does not reject, which is
  // the whole reason the hook reads `error` rather than catching.
  getSession.mockResolvedValue({
    data: { user: { id: "u1", role: "user" } },
    error: null,
  });
  config.mockReturnValue({
    data: { disableWorkspaceCreation: false },
    isPending: false,
  });
  getBilling.mockResolvedValue({ billingEnabled: false });
  inviteMember.mockResolvedValue({ id: "invite-1" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
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

const toWorkspace = {
  to: "/dashboard/workspace/$workspaceId",
  params: { workspaceId: "workspace-1" },
  replace: true,
};

const trialBilling = {
  billingEnabled: true,
  foundingFree: false,
  plan: null,
  status: null,
  trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
};

const submitWorkspace = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "auth:onboarding.createWorkspace" }),
  );

async function createCloudWorkspace(usage: "solo" | "team" = "team") {
  config.mockReturnValue({ data: { isCloud: true }, isPending: false });
  render(<OnboardingFlow />);
  await settled();
  fireEvent.change(screen.getByLabelText("auth:onboarding.workspaceName"), {
    target: { value: "My team" },
  });
  if (usage === "solo") {
    fireEvent.click(screen.getByLabelText(/auth:onboarding.cloud.usageSolo/));
  }
  submitWorkspace();
  await settled();
}

describe("OnboardingFlow", () => {
  it("previews the cloud workspace name and asks a team to invite", async () => {
    config.mockReturnValue({ data: { isCloud: true }, isPending: false });
    render(<OnboardingFlow />);
    await settled();
    fireEvent.change(screen.getByLabelText("auth:onboarding.workspaceName"), {
      target: { value: "My team" },
    });
    expect(screen.getAllByText("My team")).toHaveLength(2);
    submitWorkspace();

    expect(
      await screen.findByText("auth:onboarding.cloud.invite.title"),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.queryByText("auth:onboarding.workspaceCreatedTitle"),
    ).not.toBeInTheDocument();
    expect(createWorkspace).toHaveBeenCalledTimes(1);
  });

  it("skips invites and the plan step when billing is off", async () => {
    await createCloudWorkspace();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "auth:onboarding.cloud.invite.skip",
      }),
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(toWorkspace));
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it("keeps only failed addresses on the invite step for a retry", async () => {
    inviteMember.mockImplementation(({ email }: { email: string }) =>
      email === "b@example.com"
        ? Promise.reject(new Error("already a member"))
        : Promise.resolve({ id: "invite-1" }),
    );
    await createCloudWorkspace();
    const [first, second] = await screen.findAllByPlaceholderText(
      "auth:onboarding.cloud.invite.emailPlaceholder",
    );
    fireEvent.change(first, { target: { value: "a@example.com" } });
    fireEvent.change(second, { target: { value: "b@example.com" } });
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.cloud.invite.send" }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText(
          "auth:onboarding.cloud.invite.emailPlaceholder",
        ),
      ).toHaveLength(1),
    );
    expect(screen.getByDisplayValue("b@example.com")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    inviteMember.mockClear();
    inviteMember.mockResolvedValue({ id: "invite-2" });
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.cloud.invite.send" }),
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(toWorkspace));
    expect(inviteMember).toHaveBeenCalledWith({
      email: "b@example.com",
      workspaceId: "workspace-1",
      role: "member",
      resend: true,
    });
  });

  it("invites each filled address once and moves on", async () => {
    await createCloudWorkspace();
    const [first, second] = await screen.findAllByPlaceholderText(
      "auth:onboarding.cloud.invite.emailPlaceholder",
    );
    fireEvent.change(first, { target: { value: "a@example.com" } });
    fireEvent.change(second, { target: { value: "A@example.com" } });
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.cloud.invite.send" }),
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(toWorkspace));
    expect(inviteMember).toHaveBeenCalledTimes(1);
    expect(inviteMember).toHaveBeenCalledWith({
      email: "a@example.com",
      workspaceId: "workspace-1",
      role: "member",
    });
  });

  it("holds the invite step on a malformed address", async () => {
    await createCloudWorkspace();
    const [first] = await screen.findAllByPlaceholderText(
      "auth:onboarding.cloud.invite.emailPlaceholder",
    );
    fireEvent.change(first, { target: { value: "not-an-email" } });
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.cloud.invite.send" }),
    );

    expect(
      await screen.findByText("auth:onboarding.cloud.invite.invalidEmail"),
    ).toBeInTheDocument();
    expect(first).toHaveFocus();
    expect(first).toHaveAccessibleDescription(
      "auth:onboarding.cloud.invite.invalidEmail",
    );
    expect(inviteMember).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers a plan to a solo user on a trial", async () => {
    getBilling.mockResolvedValue(trialBilling);
    await createCloudWorkspace("solo");

    expect(
      await screen.findByText("auth:onboarding.cloud.plan.title"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("auth:onboarding.cloud.invite.title"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "auth:onboarding.cloud.plan.continueTrial",
      }),
    );
    expect(navigate).toHaveBeenCalledWith(toWorkspace);
  });

  it("leaves a pricing-page plan choice to the checkout redirect", async () => {
    getBilling.mockResolvedValue(trialBilling);
    localStorage.setItem("kaneo:pending-checkout", "team-annual");
    await createCloudWorkspace("solo");

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(toWorkspace));
    expect(
      screen.queryByText("auth:onboarding.cloud.plan.title"),
    ).not.toBeInTheDocument();
  });

  it("goes to the workspace when billing cannot be read", async () => {
    getBilling.mockRejectedValue(new Error("offline"));
    await createCloudWorkspace("solo");

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(toWorkspace));
  });

  it("keeps the self-hosted success step and delayed navigation", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<OnboardingFlow />);
    await settled();
    fireEvent.change(screen.getByLabelText("auth:onboarding.workspaceName"), {
      target: { value: "My team" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.createWorkspace" }),
    );
    await settled();
    expect(navigate).not.toHaveBeenCalled();
    // A config recovery must not reveal the form again after creation.
    config.mockReturnValue({ data: { isCloud: true }, isPending: false });
    rerender(<OnboardingFlow />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(
      screen.getByText("auth:onboarding.workspaceCreatedTitle"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "auth:onboarding.createWorkspace" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

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
    getSession.mockResolvedValue({
      data: { user: { id: "u1", role: "admin" } },
      error: null,
    });

    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("waits for config before choosing the layout for an instance admin", async () => {
    // Cloud mode determines the layout even when creation is unrestricted.
    config.mockReturnValue({ data: undefined, isPending: true });
    getSession.mockResolvedValue({
      data: { user: { id: "u1", role: "admin" } },
      error: null,
    });

    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("still decides when the role refresh fails", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    getSession.mockResolvedValue({ data: null, error: { status: 500 } });

    render(<OnboardingFlow />);
    await settled();
    await settled();

    // The cached role stands, the screen resolves, and the failure does not
    // escape as a global error.
    expect(creationForm()).toBeInTheDocument();
    expect(unhandled).not.toHaveBeenCalled();
    process.off("unhandledRejection", unhandled);
  });

  it("offers the form when the role refresh fails under a restriction", async () => {
    // The cached role cannot be trusted to take the form away: the one user
    // whose role is most likely wrong here is the freshly promoted first
    // administrator, who is entitled to it. The API still refuses the
    // creation if the role really is `user`.
    config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    // The request failed; the session store would keep the stale role and
    // report it alongside the error rather than rejecting.
    getSession.mockResolvedValue({
      data: null,
      error: { status: 500, message: "network" },
    });

    render(<OnboardingFlow />);
    await settled();
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("shows progress while the decision is pending", async () => {
    config.mockReturnValue({ data: undefined, isPending: true });

    render(<OnboardingFlow />);
    await settled();

    // Neither branch renders yet, and an empty page is not an answer.
    expect(screen.getByRole("status")).toBeInTheDocument();
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

  it("re-reads the role past the cookie cache", async () => {
    render(<OnboardingFlow />);
    await settled();

    // The first admin of an instance is promoted after the session is cached,
    // so the cached copy is exactly the one that cannot be trusted here.
    expect(getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
  });

  it("prefers the re-read role over the cached one", async () => {
    // The promotion the cached session has not caught up with yet.
    config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    getSession.mockResolvedValue({
      data: { user: { id: "u1", role: "admin" } },
      error: null,
    });

    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("re-reads the role only once, however often it rerenders", async () => {
    const { rerender } = render(<OnboardingFlow />);
    await settled();

    getSession.mockClear();
    rerender(<OnboardingFlow />);
    await settled();
    rerender(<OnboardingFlow />);
    await settled();

    expect(getSession).not.toHaveBeenCalled();
  });
});
