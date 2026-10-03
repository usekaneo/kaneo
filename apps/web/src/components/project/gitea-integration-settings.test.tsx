import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CreateGiteaIntegrationRequest } from "@/fetchers/gitea-integration/create-gitea-integration";
import type { UpdateGiteaIntegrationRequest } from "@/fetchers/gitea-integration/update-gitea-integration";
import { GiteaIntegrationSettings } from "./gitea-integration-settings";

type IssueSyncMode = "sync" | "ingest-only" | "off";
type SavedIntegration = {
  id: string;
  baseUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  isActive: boolean;
  issueSyncMode: IssueSyncMode;
  commentTaskLinkOnGiteaIssue: boolean;
};
const { verify, success, failure, get, create, update, importIssues, server, translate } = vi.hoisted(() => ({
  verify: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  importIssues: vi.fn(),
  server: { integration: null as SavedIntegration | null },
  translate: (key: string) => key,
}));
const permissions = vi.hoisted(() => ({ create: true, update: true }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => permissions.create,
    canUpdateTasks: () => permissions.update,
  }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/fetchers/gitea-integration/get-gitea-integration", () => ({ default: get }));
vi.mock("@/fetchers/gitea-integration/create-gitea-integration", () => ({ default: create }));
vi.mock("@/fetchers/gitea-integration/verify-gitea-access", () => ({ default: verify }));
vi.mock("@/fetchers/gitea-integration/update-gitea-integration", () => ({ default: update }));
vi.mock("@/fetchers/gitea-integration/import-gitea-issues", () => ({ default: importIssues }));
vi.mock("@/components/project/gitea-repository-browser-modal", () => ({
  GiteaRepositoryBrowserModal: () => null,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success, error: failure, warning: vi.fn() },
}));
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <GiteaIntegrationSettings projectId="project" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  server.integration = {
    id: "integration",
    baseUrl: "https://gitea.example",
    repositoryOwner: "owner",
    repositoryName: "repo",
    isActive: true,
    issueSyncMode: "sync",
    commentTaskLinkOnGiteaIssue: true,
  };
  get.mockImplementation(async () => server.integration && { ...server.integration });
  verify.mockResolvedValue({ isInstalled: true, hasRequiredPermissions: true, message: "Access verified" });
  update.mockImplementation(async (_projectId: string, json: UpdateGiteaIntegrationRequest) => {
    server.integration = { ...server.integration!, ...json };
    return server.integration;
  });
  importIssues.mockResolvedValue({ imported: 1 });
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  permissions.create = true;
  permissions.update = true;
  vi.clearAllMocks();
});
describe("saved Gitea verification", () => {
  it("verifies an existing integration without exposing or reentering its saved token", async () => {
    verify.mockResolvedValue({
      isInstalled: true,
      hasRequiredPermissions: true,
    });
    mount();
    const button = await screen.findByRole("button", {
      name: "settings:giteaIntegration.verify",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(
      screen.getByRole("button", {
        name: "settings:giteaIntegration.importIssues",
      }),
    ).toBeEnabled();
  });
  it("shows verification errors for a saved integration", async () => {
    verify.mockRejectedValue(new Error("Verification failed"));
    mount();
    const button = await screen.findByRole("button", {
      name: "settings:giteaIntegration.verify",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() =>
      expect(failure).toHaveBeenCalledWith("Verification failed"),
    );
    expect(success).not.toHaveBeenCalled();
  });
});

it.each(["create", "update"] as const)(
  "disables verified Gitea imports without %s permission",
  async (permission) => {
    permissions[permission] = false;
    verify.mockResolvedValue({
      isInstalled: true,
      hasRequiredPermissions: true,
    });
    mount();
    const verifyButton = await screen.findByRole("button", {
      name: "settings:giteaIntegration.verify",
    });
    await waitFor(() => expect(verifyButton).toBeEnabled());
    fireEvent.click(verifyButton);
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(
      screen.getByRole("button", {
        name: "settings:giteaIntegration.importIssues",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText("settings:gitlabIntegration.importPermissionHint"),
    ).toBeInTheDocument();
  },
);
