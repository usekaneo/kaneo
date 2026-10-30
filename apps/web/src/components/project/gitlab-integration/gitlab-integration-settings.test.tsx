import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { GitlabIntegrationSettings } from "./gitlab-integration-settings";

const m = vi.hoisted(() => ({
  verify: vi.fn(),
  create: vi.fn(),
  importIssues: vi.fn(),
  refetch: vi.fn(),
  query: {
    current: { data: null, isLoading: false, error: null } as Record<
      string,
      unknown
    >,
  },
}));
const saved = {
  baseUrl: "https://gitlab.example",
  projectPath: "group/sub/project",
  tokenType: "private",
  maskedAccessToken: "gl…yz",
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
vi.mock(
  "@/hooks/queries/gitlab-integration/use-get-gitlab-integration",
  () => ({
    default: () => ({ ...m.query.current, refetch: m.refetch }),
  }),
);
vi.mock(
  "@/hooks/mutations/gitlab-integration/use-create-gitlab-integration",
  () => ({
    useVerifyGitlabAccess: () => ({ mutateAsync: m.verify, isPending: false }),
    useCreateGitlabIntegration: () => ({
      mutateAsync: m.create,
      isPending: false,
    }),
    useDeleteGitlabIntegration: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  }),
);
vi.mock(
  "@/hooks/mutations/gitlab-integration/use-update-gitlab-integration",
  () => ({
    useUpdateGitlabIntegration: () => ({ mutateAsync: vi.fn() }),
  }),
);
vi.mock(
  "@/hooks/mutations/gitlab-integration/use-import-gitlab-issues",
  () => ({
    default: () => ({ mutateAsync: m.importIssues }),
  }),
);
vi.mock(
  "@/components/project/gitlab-integration/gitlab-project-picker",
  () => ({
    GitlabProjectPicker: () => null,
  }),
);
vi.mock("@/components/project/sync-rules/sync-rules-section", () => ({
  SyncRulesSection: () => <p>Sync rules</p>,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  permissions.create = true;
  permissions.update = true;
  m.query.current = { data: null, isLoading: false, error: null };
  m.verify.mockResolvedValue({
    isInstalled: true,
    hasRequiredPermissions: true,
    message: "Token can access the project",
  });
});

describe("GitLab setup", () => {
  it("starts on GitLab.com and connects a verified project path", async () => {
    m.create.mockResolvedValue({});
    render(<GitlabIntegrationSettings projectId="project" />);
    expect(
      screen.getByLabelText("settings:gitlabIntegration.baseUrlLabel"),
    ).toHaveValue("https://gitlab.com");
    fireEvent.change(
      screen.getByLabelText("settings:gitlabIntegration.tokenLabel"),
      { target: { value: "token" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "settings:gitlabIntegration.projectPathLabel",
      }),
      { target: { value: "/group/sub/project/" } },
    );
    await screen.findByText(
      "Token can access the project",
      {},
      { timeout: 2000 },
    );
    expect(m.verify).toHaveBeenCalledWith({
      projectId: "project",
      baseUrl: "https://gitlab.com",
      accessToken: "token",
      tokenType: "private",
      projectPath: "group/sub/project",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:codeHosting.connectProject",
      }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        projectId: "project",
        data: {
          baseUrl: "https://gitlab.com",
          accessToken: "token",
          tokenType: "private",
          projectPath: "group/sub/project",
        },
      }),
    );
  });

  it("offers a retry when the integration cannot be read", () => {
    m.query.current = {
      data: undefined,
      isLoading: false,
      error: new Error("Unavailable"),
    };
    render(<GitlabIntegrationSettings projectId="project" />);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.retry" }),
    );
    expect(m.refetch).toHaveBeenCalled();
  });
});

describe("connected GitLab project", () => {
  it("imports issues without asking for the token again", async () => {
    m.query.current = { data: saved, isLoading: false, error: null };
    m.importIssues.mockResolvedValue({});
    render(<GitlabIntegrationSettings projectId="project" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.importIssues" }),
    );
    await waitFor(() => expect(m.importIssues).toHaveBeenCalledWith("project"));
    expect(m.verify).not.toHaveBeenCalled();
  });

  it("reconnects a paused project with the stored token", async () => {
    m.query.current = {
      data: { ...saved, isActive: false },
      isLoading: false,
      error: null,
    };
    m.create.mockResolvedValue({});
    render(<GitlabIntegrationSettings projectId="project" />);
    expect(
      screen.getByRole("button", { name: "settings:codeHosting.importIssues" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.reconnect" }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        projectId: "project",
        data: {
          baseUrl: saved.baseUrl,
          tokenType: "private",
          projectPath: saved.projectPath,
        },
      }),
    );
  });
});
