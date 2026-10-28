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
import { GiteaIntegrationSettings } from "./gitea-integration-settings";

const m = vi.hoisted(() => ({
  verify: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  importIssues: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
  integration: { current: null as null | Record<string, unknown> },
}));
const saved = {
  baseUrl: "https://gitea.example",
  repositoryOwner: "owner",
  repositoryName: "repo",
  maskedAccessToken: "ab…yz",
  webhookUrl: "https://kaneo.example/api/gitea-integration/webhook/1",
  webhookSecret: "webhook-secret",
  isActive: true,
};
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
vi.mock("@/hooks/queries/gitea-integration/use-get-gitea-integration", () => ({
  default: () => ({ data: m.integration.current, isLoading: false }),
}));
vi.mock(
  "@/hooks/mutations/gitea-integration/use-create-gitea-integration",
  () => ({
    useVerifyGiteaAccess: () => ({ mutateAsync: m.verify, isPending: false }),
    useCreateGiteaIntegration: () => ({
      mutateAsync: m.create,
      isPending: false,
    }),
    useDeleteGiteaIntegration: () => ({
      mutateAsync: m.remove,
      isPending: false,
    }),
  }),
);
vi.mock(
  "@/hooks/mutations/gitea-integration/use-update-gitea-integration",
  () => ({
    useUpdateGiteaIntegration: () => ({ mutateAsync: vi.fn() }),
  }),
);
vi.mock("@/hooks/mutations/gitea-integration/use-import-gitea-issues", () => ({
  default: () => ({ mutateAsync: m.importIssues }),
}));
vi.mock(
  "@/components/project/gitea-integration/gitea-repository-picker",
  () => ({
    GiteaRepositoryPicker: () => null,
  }),
);
vi.mock("@/components/project/sync-rules/sync-rules-section", () => ({
  SyncRulesSection: () => <p>Sync rules</p>,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.failure, warning: vi.fn() },
}));

const verified = {
  isInstalled: true,
  hasRequiredPermissions: true,
  message: "Token can access the repository",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  permissions.create = true;
  permissions.update = true;
  m.integration.current = saved;
  m.verify.mockResolvedValue(verified);
});

describe("connected Gitea repository", () => {
  it("verifies the saved token automatically without exposing or reentering it", async () => {
    render(<GiteaIntegrationSettings projectId="project" />);
    expect(
      await screen.findByText(verified.message, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(m.verify).toHaveBeenCalledWith({
      projectId: "project",
      baseUrl: saved.baseUrl,
      repositoryOwner: "owner",
      repositoryName: "repo",
      accessToken: undefined,
    });
    const importButton = screen.getByRole("button", {
      name: "settings:codeHosting.importIssues",
    });
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);
    await waitFor(() => expect(m.importIssues).toHaveBeenCalledWith("project"));
    expect(screen.queryByText(saved.webhookSecret)).toBeNull();
  });

  it("shows verification errors and keeps importing disabled", async () => {
    m.verify.mockRejectedValue(new Error("Verification failed"));
    render(<GiteaIntegrationSettings projectId="project" />);
    expect(
      await screen.findByText("Verification failed", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "settings:codeHosting.importIssues" }),
    ).toBeDisabled();
  });

  it("reveals the webhook secret only on request", async () => {
    render(<GiteaIntegrationSettings projectId="project" />);
    expect(screen.queryByText(saved.webhookSecret)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.showSecret" }),
    );
    expect(screen.getByText(saved.webhookSecret)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "settings:codeHosting.webhookUrl" }),
    ).toHaveValue(saved.webhookUrl);
  });

  it("rotates the token after verifying the new one", async () => {
    m.create.mockResolvedValue({});
    render(<GiteaIntegrationSettings projectId="project" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.changeToken" }),
    );
    fireEvent.change(
      screen.getByLabelText("settings:giteaIntegration.tokenLabel"),
      { target: { value: " new-token " } },
    );
    await waitFor(
      () =>
        expect(m.verify).toHaveBeenCalledWith(
          expect.objectContaining({ accessToken: "new-token" }),
        ),
      { timeout: 2000 },
    );
    const saveButton = screen.getByRole("button", {
      name: "settings:codeHosting.saveToken",
    });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        projectId: "project",
        data: {
          baseUrl: saved.baseUrl,
          accessToken: "new-token",
          repositoryOwner: "owner",
          repositoryName: "repo",
        },
      }),
    );
  });

  it("disconnects only after confirmation", async () => {
    m.remove.mockResolvedValue({});
    render(<GiteaIntegrationSettings projectId="project" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.disconnect" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:codeHosting.disconnect",
      }),
    );
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith("project"));
  });
});

describe("Gitea setup", () => {
  it("maps owner/name to the existing fields and connects once access is verified", async () => {
    m.integration.current = null;
    m.create.mockResolvedValue({});
    render(<GiteaIntegrationSettings projectId="project" />);
    fireEvent.change(
      screen.getByLabelText("settings:giteaIntegration.baseUrlLabel"),
      { target: { value: "https://gitea.example" } },
    );
    fireEvent.change(
      screen.getByLabelText("settings:giteaIntegration.tokenLabel"),
      { target: { value: "token" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "settings:codeHosting.repositoryPathLabel",
      }),
      { target: { value: "my_org/repo" } },
    );
    expect(
      await screen.findByText(verified.message, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(m.verify).toHaveBeenCalledWith({
      projectId: "project",
      baseUrl: "https://gitea.example",
      accessToken: "token",
      repositoryOwner: "my_org",
      repositoryName: "repo",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:codeHosting.connectRepository",
      }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        projectId: "project",
        data: {
          baseUrl: "https://gitea.example",
          accessToken: "token",
          repositoryOwner: "my_org",
          repositoryName: "repo",
        },
      }),
    );
    expect(m.verify).toHaveBeenCalledTimes(1);
  });
});

it.each(["create", "update"] as const)(
  "disables verified Gitea imports without %s permission",
  async (permission) => {
    permissions[permission] = false;
    render(<GiteaIntegrationSettings projectId="project" />);
    await screen.findByText(verified.message, {}, { timeout: 2000 });
    expect(
      screen.getByRole("button", {
        name: "settings:codeHosting.importIssues",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText("settings:gitlabIntegration.importPermissionHint"),
    ).toBeInTheDocument();
  },
);
