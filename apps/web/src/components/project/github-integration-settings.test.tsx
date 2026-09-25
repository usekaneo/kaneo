import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  appInfo: vi.fn(),
  link: vi.fn(),
  importIssues: vi.fn(),
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
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useDeleteGithubIntegration: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useVerifyGithubInstallation: () => ({
      mutateAsync: vi.fn(),
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
vi.mock("@/components/project/repository-browser-modal", () => ({
  RepositoryBrowserModal: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { toast } from "@/lib/toast";

import { GitHubIntegrationSettings } from "./github-integration-settings";

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
  m.link.mockResolvedValue({ error: null });
});
describe("GitHub account verification flow", () => {
  it("offers explicit account linking and returns to the same settings page", async () => {
    m.appInfo.mockResolvedValue({
      accountConnected: false,
      accountLinkingAvailable: true,
    });
    show();
    const button = await screen.findByRole("button", {
      name: "settings:githubIntegration.connect GitHub",
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(m.link).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: window.location.href,
      }),
    );
    expect(
      screen.getByRole("button", { name: "settings:githubIntegration.browse" }),
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
        name: "settings:githubIntegration.connect GitHub",
      }),
    ).not.toBeInTheDocument();
  });
  it("shows reconnection for legacy integrations and still permits removal", async () => {
    m.appInfo.mockResolvedValue({
      accountConnected: true,
      accountLinkingAvailable: true,
    });
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
      screen.getByRole("button", {
        name: "settings:githubIntegration.disconnect",
      }),
    ).toBeEnabled();
    expect(
      screen.getByText("settings:githubIntegration.badgeNotConnected"),
    ).toBeInTheDocument();
  });
});

describe("saved GitHub import progress", () => {
  it("offers resume after refresh and forwards the persisted run ID", async () => {
    m.appInfo.mockResolvedValue({
      accountConnected: true,
      accountLinkingAvailable: true,
    });
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "settings:githubIntegration.importPaused",
    );
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
        { description: "settings:githubIntegration.importSummary" },
      ),
    );
  });
});
