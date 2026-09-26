import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GiteaIntegrationSettings } from "./gitea-integration-settings";

const { verify, success, failure, integration, translate } = vi.hoisted(() => ({
  verify: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
  translate: (key: string) => key,
  integration: {
    baseUrl: "https://gitea.example",
    repositoryOwner: "owner",
    repositoryName: "repo",
    isActive: true,
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/hooks/queries/gitea-integration/use-get-gitea-integration", () => ({
  default: () => ({ data: integration }),
}));
vi.mock(
  "@/hooks/mutations/gitea-integration/use-create-gitea-integration",
  () => ({
    useVerifyGiteaAccess: () => ({ mutateAsync: verify, isPending: false }),
    useCreateGiteaIntegration: () => ({ mutateAsync: vi.fn() }),
    useDeleteGiteaIntegration: () => ({ mutateAsync: vi.fn() }),
  }),
);
vi.mock(
  "@/hooks/mutations/gitea-integration/use-update-gitea-integration",
  () => ({ useUpdateGiteaIntegration: () => ({ mutateAsync: vi.fn() }) }),
);
vi.mock("@/hooks/mutations/gitea-integration/use-import-gitea-issues", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/components/project/gitea-repository-browser-modal", () => ({
  GiteaRepositoryBrowserModal: () => null,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success, error: failure, warning: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("saved Gitea verification", () => {
  it("verifies an existing integration without exposing or reentering its saved token", async () => {
    verify.mockResolvedValue({
      isInstalled: true,
      hasRequiredPermissions: true,
    });
    render(<GiteaIntegrationSettings projectId="project" />);
    const button = screen.getByRole("button", {
      name: "settings:giteaIntegration.verify",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(verify).toHaveBeenCalledWith({
      projectId: "project",
      baseUrl: integration.baseUrl,
      repositoryOwner: "owner",
      repositoryName: "repo",
      accessToken: undefined,
    });
  });
  it("shows verification errors for a saved integration", async () => {
    verify.mockRejectedValue(new Error("Verification failed"));
    render(<GiteaIntegrationSettings projectId="project" />);
    const button = screen.getByRole("button", {
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
