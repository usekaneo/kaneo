import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const m = vi.hoisted(() => ({
  appInfo: vi.fn(),
  link: vi.fn(),
  importIssues: vi.fn(),
  verify: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  integration: { current: null as null | Record<string, unknown> },
}));
vi.mock("@/fetchers/github-integration/get-app-info", () => ({
  default: m.appInfo,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1" } } }),
    linkSocial: m.link,
  },
}));
vi.mock(
  "@/hooks/queries/github-integration/use-get-github-integration",
  () => ({
    default: () => ({ data: m.integration.current, isLoading: false }),
  }),
);
vi.mock(
  "@/hooks/mutations/github-integration/use-create-github-integration",
  () => ({
    useCreateGithubIntegration: () => ({
      mutateAsync: m.create,
      isPending: false,
    }),
    useDeleteGithubIntegration: () => ({
      mutateAsync: m.remove,
      isPending: false,
    }),
    useVerifyGithubInstallation: () => ({
      mutateAsync: m.verify,
      isPending: false,
    }),
  }),
);
vi.mock(
  "@/hooks/mutations/github-integration/use-import-github-issues",
  () => ({
    default: () => ({ mutateAsync: m.importIssues, isPending: false }),
  }),
);
vi.mock(
  "@/hooks/mutations/github-integration/use-update-github-integration",
  () => ({
    useUpdateGithubIntegration: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  }),
);
vi.mock(
  "@/components/project/github-integration/github-repository-picker",
  () => ({
    GithubRepositoryPicker: () => null,
  }),
);
vi.mock("@/components/project/sync-rules/sync-rules-section", () => ({
  SyncRulesSection: () => <p>Sync rules</p>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));
const permissions = vi.hoisted(() => ({ create: true, update: true }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => permissions.create,
    canUpdateTasks: () => permissions.update,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { toast } from "@/lib/toast";

import { GitHubIntegrationSettings } from "./github-integration-settings";

const linkedAccount = {
  accountConnected: true,
  accountLinkingAvailable: true,
  appName: "kaneo",
};
const readyVerification = {
  isInstalled: true,
  installationId: 1,
  repositoryExists: true,
  repositoryPrivate: false,
  permissions: null,
  hasRequiredPermissions: true,
  missingPermissions: [],
  message: "Installed",
};

function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <GitHubIntegrationSettings projectId="project" />
    </QueryClientProvider>,
  );
}
afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  m.integration.current = null;
  permissions.create = true;
  permissions.update = true;
  m.link.mockResolvedValue({ error: null });
  m.verify.mockResolvedValue(readyVerification);
});

describe("GitHub account step", () => {
  it("offers explicit account linking and returns to the same settings page", async () => {
    m.appInfo.mockResolvedValue({
      accountConnected: false,
      accountLinkingAvailable: true,
    });
    show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:githubIntegration.linkGithub",
      }),
    );
    await waitFor(() =>
      expect(m.link).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: window.location.href,
      }),
    );
    expect(
      screen.getByRole("button", { name: "settings:codeHosting.browse" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "settings:codeHosting.connectRepository",
      }),
    ).toBeDisabled();
  });

  it("explains the administrator prerequisite when GitHub sign-in is disabled", async () => {
    m.appInfo.mockResolvedValue({
      accountConnected: false,
      accountLinkingAvailable: false,
    });
    show();
    expect(
      await screen.findByText(
        "settings:githubIntegration.enableGithubSignInHint",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "settings:githubIntegration.linkGithub",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("GitHub repository step", () => {
  it("verifies a typed owner/name automatically and connects it", async () => {
    m.appInfo.mockResolvedValue(linkedAccount);
    show();
    await screen.findByText("settings:githubIntegration.linked");
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "settings:codeHosting.repositoryPathLabel",
      }),
      { target: { value: "acme/web" } },
    );
    expect(
      await screen.findByText(
        "settings:githubIntegration.verifyReady",
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
    expect(m.verify).toHaveBeenCalledWith({
      projectId: "project",
      repositoryOwner: "acme",
      repositoryName: "web",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:codeHosting.connectRepository",
      }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        projectId: "project",
        data: { repositoryOwner: "acme", repositoryName: "web" },
      }),
    );
  });

  it("blocks connecting when the App is missing permissions and links to its settings", async () => {
    m.appInfo.mockResolvedValue(linkedAccount);
    m.verify.mockResolvedValue({
      ...readyVerification,
      hasRequiredPermissions: false,
      missingPermissions: ["issues"],
      settingsUrl: "https://github.com/settings/installations/1",
    });
    show();
    await screen.findByText("settings:githubIntegration.linked");
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "settings:codeHosting.repositoryPathLabel",
      }),
      { target: { value: "acme/web" } },
    );
    expect(
      await screen.findByRole(
        "button",
        { name: "settings:githubIntegration.updatePermissions" },
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "settings:codeHosting.connectRepository",
      }),
    ).toBeDisabled();
  });

  it("explains the expected format instead of verifying an invalid value", async () => {
    m.appInfo.mockResolvedValue(linkedAccount);
    show();
    await screen.findByText("settings:githubIntegration.linked");
    const input = screen.getByRole("textbox", {
      name: "settings:codeHosting.repositoryPathLabel",
    });
    fireEvent.change(input, { target: { value: "not a repository" } });
    fireEvent.blur(input);
    expect(
      screen.getByText("settings:codeHosting.repositoryPathInvalid"),
    ).toBeInTheDocument();
    expect(m.verify).not.toHaveBeenCalled();
  });
});

describe("connected GitHub repository", () => {
  it("asks to reconnect legacy integrations and still permits removal after confirmation", async () => {
    m.appInfo.mockResolvedValue(linkedAccount);
    m.remove.mockResolvedValue(undefined);
    m.integration.current = {
      repositoryOwner: "owner",
      repositoryName: "repo",
      requiresVerification: true,
      isActive: false,
    };
    show();
    expect(
      await screen.findByText("settings:githubIntegration.reverifyHint"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "settings:codeHosting.reconnect",
      }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.disconnect" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("settings:codeHosting.disconnectTitle"),
    ).toBeInTheDocument();
    expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:codeHosting.disconnect",
      }),
    );
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith("project"));
  });

  it("reconnects the saved repository through verification", async () => {
    m.appInfo.mockResolvedValue(linkedAccount);
    m.integration.current = {
      repositoryOwner: "owner",
      repositoryName: "repo",
      requiresVerification: true,
      isActive: false,
    };
    show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:codeHosting.reconnect",
      }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        projectId: "project",
        data: { repositoryOwner: "owner", repositoryName: "repo" },
      }),
    );
  });

  it("offers resume after refresh and forwards the persisted run ID", async () => {
    m.appInfo.mockResolvedValue(linkedAccount);
    m.integration.current = {
      repositoryOwner: "owner",
      repositoryName: "repo",
      installationId: 1,
      requiresVerification: false,
      isActive: true,
      importProgress: {
        runId: "saved-run",
        pending: true,
        imported: 4,
        updated: 0,
        skipped: 0,
      },
    };
    let complete!: (result: unknown) => void;
    m.importIssues.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    show();
    const resume = await screen.findByRole("button", {
      name: "settings:githubIntegration.resumeImport",
    });
    expect(
      screen.getByText(
        "settings:githubIntegration.importPaused settings:codeHosting.lastImport",
      ),
    ).toBeInTheDocument();
    fireEvent.click(resume);
    await waitFor(() =>
      expect(m.importIssues).toHaveBeenCalledWith({
        projectId: "project",
        runId: "saved-run",
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
    complete({
      runId: "saved-run",
      pending: false,
      imported: 9,
      updated: 1,
      skipped: 2,
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "settings:githubIntegration.toast.issuesImported",
        {
          description: "settings:githubIntegration.importSummary",
          icon: expect.anything(),
        },
      ),
    );
  });

  it("shows the App status for an active repository", async () => {
    m.appInfo.mockResolvedValue(linkedAccount);
    m.integration.current = {
      repositoryOwner: "owner",
      repositoryName: "repo",
      isActive: true,
      requiresVerification: false,
    };
    show();
    expect(
      await screen.findByText(
        "settings:githubIntegration.verifyReady",
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Sync rules")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /owner\/repo/ })).toHaveAttribute(
      "href",
      "https://github.com/owner/repo",
    );
  });
});

it.each(["create", "update"] as const)(
  "disables GitHub imports without %s permission",
  async (permission) => {
    permissions[permission] = false;
    m.appInfo.mockResolvedValue(linkedAccount);
    m.integration.current = {
      repositoryOwner: "owner",
      repositoryName: "repo",
      isActive: true,
      requiresVerification: false,
    };
    show();
    const button = await screen.findByRole("button", {
      name: "settings:codeHosting.importIssues",
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(m.importIssues).not.toHaveBeenCalled();
    expect(
      screen.getByText("settings:gitlabIntegration.importPermissionHint"),
    ).toBeInTheDocument();
  },
);
