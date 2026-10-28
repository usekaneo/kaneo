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

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  createWorkspace: vi.fn(),
  createStarterProject: vi.fn(),
  config: vi.fn(),
  authUser: vi.fn(),
  getSession: vi.fn(),
  getBilling: vi.fn(),
  inviteMember: vi.fn(),
  checkout: vi.fn(),
  signOut: vi.fn(),
  useSignOut: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => m.navigate,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => m.config(),
}));
vi.mock("@/hooks/mutations/use-sign-out", () => ({
  default: (logoutUrl?: string | null) => m.useSignOut(logoutUrl),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: m.toastError, success: vi.fn() },
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: { setActive: vi.fn() },
    getSession: (options: unknown) => m.getSession(options),
    signOut: () => m.signOut(),
  },
}));
vi.mock("@/fetchers/billing/get-billing", () => ({
  getBilling: (workspaceId: string) => m.getBilling(workspaceId),
}));
vi.mock("@/hooks/mutations/billing/use-billing-actions", () => ({
  useCreateCheckout: () => ({ mutate: m.checkout, isPending: false }),
}));
vi.mock("@/hooks/mutations/workspace-user/use-invite-workspace-user", () => ({
  default: () => ({ mutateAsync: m.inviteMember }),
}));
vi.mock("@/hooks/queries/workspace/use-create-workspace", () => ({
  default: () => ({ mutateAsync: m.createWorkspace, isPending: false }),
}));
vi.mock("@/lib/onboarding/create-starter-project", () => ({
  FALLBACK_PROJECT_SLUG: "PRJ",
  createStarterProject: (input: unknown) => m.createStarterProject(input),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: m.authUser(), refetchUser: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

beforeEach(() => {
  m.createWorkspace.mockResolvedValue({ id: "workspace-1" });
  m.createStarterProject.mockResolvedValue("project-1");
  m.authUser.mockReturnValue({
    id: "u1",
    name: "Sam Lee",
    email: "sam@example.com",
    role: "user",
  });
  m.getSession.mockResolvedValue({
    data: { user: { id: "u1", role: "user" } },
    error: null,
  });
  m.config.mockReturnValue({
    data: { disableWorkspaceCreation: false },
    isPending: false,
  });
  m.getBilling.mockResolvedValue({ billingEnabled: false });
  m.inviteMember.mockResolvedValue({ id: "invite-1" });
  m.signOut.mockResolvedValue({});
  m.useSignOut.mockReturnValue({ mutateAsync: m.signOut });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

function render(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrap = (node: ReactNode) =>
    createElement(QueryClientProvider, { client }, node) as never;
  const result = rtlRender(wrap(ui));
  return {
    ...result,
    rerender: (next: ReactNode) => result.rerender(wrap(next)),
  };
}

const settled = () => act(async () => {});
const continueButton = () =>
  screen.getByRole("button", { name: "auth:onboarding.continue" });
const creationForm = () =>
  screen.queryByText("auth:onboarding.workspace.title");
const restricted = () => screen.queryByText("auth:onboarding.restrictedTitle");

const toBoard = {
  to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
  params: { workspaceId: "workspace-1", projectId: "project-1" },
  replace: true,
};

const trialBilling = {
  billingEnabled: true,
  foundingFree: false,
  plan: null,
  status: null,
  trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
};

async function walkToProject({
  cloud = false,
  smtp = false,
  usage = "team",
}: { cloud?: boolean; smtp?: boolean; usage?: "solo" | "team" } = {}) {
  m.config.mockReturnValue({
    data: { isCloud: cloud, billingEnabled: cloud, hasSmtp: smtp },
    isPending: false,
  });
  render(<OnboardingFlow />);
  await settled();
  fireEvent.change(screen.getByLabelText("auth:onboarding.workspaceName"), {
    target: { value: "Acme" },
  });
  fireEvent.click(continueButton());
  await screen.findByText("auth:onboarding.usage.title");
  if (usage === "solo") {
    fireEvent.click(screen.getByLabelText(/auth:onboarding.cloud.usageSolo/));
  }
  fireEvent.click(continueButton());
  await screen.findByText("auth:onboarding.project.title");
}

async function createWorkspace(options?: Parameters<typeof walkToProject>[0]) {
  await walkToProject(options);
  fireEvent.click(continueButton());
  await settled();
}

describe("OnboardingFlow steps", () => {
  it("builds the preview from the answers before anything is created", async () => {
    await walkToProject();
    fireEvent.change(screen.getByLabelText("auth:onboarding.project.label"), {
      target: { value: "Website relaunch" },
    });

    expect(screen.getAllByText("Acme").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Website relaunch").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WR-1").length).toBeGreaterThan(0);
    expect(m.createWorkspace).not.toHaveBeenCalled();
  });

  it("asks for a workspace name before moving on", async () => {
    render(<OnboardingFlow />);
    await settled();
    fireEvent.click(continueButton());

    expect(
      screen.getByText("auth:onboarding.validation.workspaceNameRequired"),
    ).toBeInTheDocument();
    expect(screen.queryByText("auth:onboarding.usage.title")).toBeNull();
  });

  it("creates the workspace and starter project once, then opens it from Ready", async () => {
    await createWorkspace();

    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(m.createWorkspace).toHaveBeenCalledTimes(1);
    expect(m.createWorkspace).toHaveBeenCalledWith({
      name: "Acme",
      description: "",
      userId: "u1",
    });
    expect(m.createStarterProject).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        name: "auth:onboarding.projectNameDefault",
      }),
    );
    expect(m.navigate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.ready.open" }),
    );
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(toBoard));
  });

  it("skips invites on a self-hosted instance that cannot send email", async () => {
    await createWorkspace({ smtp: false });

    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(screen.queryByText("auth:onboarding.invite.title")).toBeNull();
  });

  it("stays on the project step and keeps the answers when creation fails", async () => {
    m.createWorkspace.mockRejectedValueOnce(new Error("slug taken"));
    await createWorkspace();

    expect(
      screen.getByText("auth:onboarding.project.title"),
    ).toBeInTheDocument();
    expect(m.createStarterProject).not.toHaveBeenCalled();
  });

  it("signs out from the footer", async () => {
    render(<OnboardingFlow />);
    await settled();
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.signOut" }),
    );

    await waitFor(() => expect(m.signOut).toHaveBeenCalledTimes(1));
    expect(m.navigate).not.toHaveBeenCalled();
  });

  it("uses the configured provider logout without a competing sign-in navigation", async () => {
    m.config.mockReturnValue({
      data: { customOAuthLogoutUrl: "https://idp.example.test/end-session" },
      isPending: false,
    });
    render(<OnboardingFlow />);
    await settled();
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.signOut" }),
    );

    await waitFor(() => expect(m.signOut).toHaveBeenCalledTimes(1));
    expect(m.useSignOut).toHaveBeenCalledWith(
      "https://idp.example.test/end-session",
    );
    expect(m.navigate).not.toHaveBeenCalled();
  });

  it("stays on onboarding and reports a failed sign-out", async () => {
    m.signOut.mockRejectedValueOnce(new Error("Could not sign out"));
    render(<OnboardingFlow />);
    await settled();
    fireEvent.click(
      screen.getByRole("button", { name: "auth:onboarding.signOut" }),
    );

    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith("Could not sign out"),
    );
    expect(m.navigate).not.toHaveBeenCalled();
    expect(creationForm()).toBeInTheDocument();
  });
});

describe("OnboardingFlow invites", () => {
  const sendButton = () =>
    screen.getByRole("button", { name: "auth:onboarding.invite.send" });

  it("invites each filled address once and moves on", async () => {
    await createWorkspace({ smtp: true });
    const [first, second] = await screen.findAllByPlaceholderText(
      "auth:onboarding.cloud.invite.emailPlaceholder",
    );
    fireEvent.change(first, { target: { value: "a@example.com" } });
    fireEvent.change(second, { target: { value: "A@example.com" } });
    fireEvent.click(sendButton());

    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(m.inviteMember).toHaveBeenCalledTimes(1);
    expect(m.inviteMember).toHaveBeenCalledWith({
      email: "a@example.com",
      workspaceId: "workspace-1",
      role: "member",
    });
  });

  it("keeps only failed addresses for a retry", async () => {
    m.inviteMember.mockImplementation(({ email }: { email: string }) =>
      email === "b@example.com"
        ? Promise.reject(new Error("already a member"))
        : Promise.resolve({ id: "invite-1" }),
    );
    await createWorkspace({ smtp: true });
    const [first, second] = await screen.findAllByPlaceholderText(
      "auth:onboarding.cloud.invite.emailPlaceholder",
    );
    fireEvent.change(first, { target: { value: "a@example.com" } });
    fireEvent.change(second, { target: { value: "b@example.com" } });
    fireEvent.click(sendButton());

    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText(
          "auth:onboarding.cloud.invite.emailPlaceholder",
        ),
      ).toHaveLength(1),
    );
    expect(screen.getByDisplayValue("b@example.com")).toBeInTheDocument();

    m.inviteMember.mockReset();
    m.inviteMember.mockResolvedValue({ id: "invite-2" });
    fireEvent.click(sendButton());

    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(m.inviteMember).toHaveBeenCalledWith({
      email: "b@example.com",
      workspaceId: "workspace-1",
      role: "member",
      resend: true,
    });
  });

  it("holds the invite step on a malformed address", async () => {
    await createWorkspace({ smtp: true });
    const [first] = await screen.findAllByPlaceholderText(
      "auth:onboarding.cloud.invite.emailPlaceholder",
    );
    fireEvent.change(first, { target: { value: "not-an-email" } });
    fireEvent.click(sendButton());

    expect(
      await screen.findByText("auth:onboarding.cloud.invite.invalidEmail"),
    ).toBeInTheDocument();
    expect(first).toHaveFocus();
    expect(m.inviteMember).not.toHaveBeenCalled();
  });

  it("can skip invites", async () => {
    await createWorkspace({ smtp: true });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "auth:onboarding.cloud.invite.skip",
      }),
    );

    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(m.inviteMember).not.toHaveBeenCalled();
  });
});

describe("OnboardingFlow plan step", () => {
  it("offers the trial or a plan on cloud, and the trial opens the workspace", async () => {
    m.getBilling.mockResolvedValue(trialBilling);
    await createWorkspace({ cloud: true, usage: "solo" });

    expect(
      await screen.findByText("auth:onboarding.plan.title"),
    ).toBeInTheDocument();
    expect(screen.queryByText("auth:onboarding.invite.title")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "auth:onboarding.cloud.plan.continueTrial",
      }),
    );

    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(toBoard));
    expect(m.checkout).not.toHaveBeenCalled();
  });

  it("subscribes to the recommended plan right away", async () => {
    m.getBilling.mockResolvedValue(trialBilling);
    await createWorkspace({ cloud: true, usage: "solo" });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "auth:onboarding.plan.subscribe",
      }),
    );

    expect(m.checkout).toHaveBeenCalledWith({
      plan: "personal",
      interval: "annual",
    });
    expect(m.navigate).not.toHaveBeenCalled();
  });

  it("puts a plan picked on the pricing page first and clears it", async () => {
    m.getBilling.mockResolvedValue(trialBilling);
    localStorage.setItem("kaneo:pending-checkout", "team-monthly");
    await createWorkspace({ cloud: true, usage: "solo" });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "auth:onboarding.plan.checkout",
      }),
    );

    expect(m.checkout).toHaveBeenCalledWith({
      plan: "team",
      interval: "monthly",
    });
    expect(localStorage.getItem("kaneo:pending-checkout")).toBeNull();
  });

  it("drops a pricing-page plan when the person chooses the trial", async () => {
    m.getBilling.mockResolvedValue(trialBilling);
    localStorage.setItem("kaneo:pending-checkout", "team-annual");
    await createWorkspace({ cloud: true, usage: "solo" });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "auth:onboarding.cloud.plan.continueTrial",
      }),
    );

    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith(toBoard));
    expect(localStorage.getItem("kaneo:pending-checkout")).toBeNull();
    expect(m.checkout).not.toHaveBeenCalled();
  });

  it("only offers subscribing once the trial is used", async () => {
    m.getBilling.mockResolvedValue({
      ...trialBilling,
      trialEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    await createWorkspace({ cloud: true, usage: "solo" });

    expect(
      await screen.findByRole("button", {
        name: "auth:onboarding.plan.subscribe",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "auth:onboarding.cloud.plan.continueTrial",
      }),
    ).toBeNull();
  });

  it("ends on Ready when billing cannot be read", async () => {
    m.getBilling.mockRejectedValue(new Error("offline"));
    await createWorkspace({ cloud: true, usage: "solo" });

    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
  });
});

describe("OnboardingFlow access", () => {
  it("offers the flow when anyone may create a workspace", async () => {
    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("explains the restriction instead of offering a flow that would fail", async () => {
    m.config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    render(<OnboardingFlow />);
    await settled();

    expect(restricted()).toBeInTheDocument();
    expect(creationForm()).not.toBeInTheDocument();
    expect(
      screen.getByText("auth:onboarding.restrictedCheckInvitations"),
    ).toBeInTheDocument();
  });

  it("still offers the flow to an instance admin when creation is restricted", async () => {
    m.config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    m.getSession.mockResolvedValue({
      data: { user: { id: "u1", role: "admin" } },
      error: null,
    });
    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("shows progress while the decision is pending", async () => {
    m.config.mockReturnValue({ data: undefined, isPending: true });
    render(<OnboardingFlow />);
    await settled();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(creationForm()).not.toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("falls back to the flow when the config request fails", async () => {
    m.config.mockReturnValue({ data: undefined, isPending: false });
    render(<OnboardingFlow />);
    await settled();

    expect(creationForm()).toBeInTheDocument();
    expect(restricted()).not.toBeInTheDocument();
  });

  it("offers the flow when the role refresh fails under a restriction", async () => {
    m.config.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
    m.getSession.mockResolvedValue({
      data: null,
      error: { status: 500, message: "network" },
    });
    render(<OnboardingFlow />);
    await settled();
    await settled();

    expect(creationForm()).toBeInTheDocument();
  });

  it("re-reads the role past the cookie cache, once", async () => {
    const { rerender } = render(<OnboardingFlow />);
    await settled();
    expect(m.getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });

    m.getSession.mockClear();
    rerender(<OnboardingFlow />);
    await settled();
    expect(m.getSession).not.toHaveBeenCalled();
  });

  it("does not bring the first step back if config recovers after creation", async () => {
    await createWorkspace();
    m.config.mockReturnValue({
      data: { isCloud: false, disableWorkspaceCreation: true },
      isPending: false,
    });
    expect(
      await screen.findByText("auth:onboarding.ready.title"),
    ).toBeInTheDocument();
    expect(creationForm()).toBeNull();
  });
});
