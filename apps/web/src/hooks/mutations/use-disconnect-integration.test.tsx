import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import deleteDiscordIntegration from "@/fetchers/discord-integration/delete-discord-integration";
import deleteGenericWebhookIntegration from "@/fetchers/generic-webhook-integration/delete-generic-webhook-integration";
import deleteGiteaIntegration from "@/fetchers/gitea-integration/delete-gitea-integration";
import getGiteaIntegrations from "@/fetchers/gitea-integration/get-gitea-integrations";
import deleteGithubIntegration from "@/fetchers/github-integration/delete-github-integration";
import getGithubIntegrations from "@/fetchers/github-integration/get-github-integrations";
import deleteGitlabIntegration from "@/fetchers/gitlab-integration/delete-gitlab-integration";
import getGitlabIntegrations from "@/fetchers/gitlab-integration/get-gitlab-integrations";
import deleteMattermostIntegration from "@/fetchers/mattermost-integration/delete-mattermost-integration";
import deleteSlackIntegration from "@/fetchers/slack-integration/delete-slack-integration";
import deleteTelegramIntegration from "@/fetchers/telegram-integration/delete-telegram-integration";
import { useDisconnectIntegration } from "./use-disconnect-integration";

// Repository bindings (github, gitea, gitlab) are deleted by integration id,
// so the project-scoped disconnect mutation must resolve the project's
// bindings first and delete each one by its own id.

vi.mock("@/fetchers/github-integration/get-github-integrations", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/github-integration/delete-github-integration", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/gitea-integration/get-gitea-integrations", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/gitea-integration/delete-gitea-integration", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/gitlab-integration/get-gitlab-integrations", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/gitlab-integration/delete-gitlab-integration", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/slack-integration/delete-slack-integration", () => ({
  default: vi.fn(),
}));
vi.mock("@/fetchers/discord-integration/delete-discord-integration", () => ({
  default: vi.fn(),
}));
vi.mock(
  "@/fetchers/mattermost-integration/delete-mattermost-integration",
  () => ({
    default: vi.fn(),
  }),
);
vi.mock("@/fetchers/telegram-integration/delete-telegram-integration", () => ({
  default: vi.fn(),
}));
vi.mock(
  "@/fetchers/generic-webhook-integration/delete-generic-webhook-integration",
  () => ({ default: vi.fn() }),
);

let queryClient: QueryClient;

function Wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useDisconnectIntegration", () => {
  it.each([
    {
      id: "github",
      list: getGithubIntegrations,
      remove: deleteGithubIntegration,
    },
    { id: "gitea", list: getGiteaIntegrations, remove: deleteGiteaIntegration },
    {
      id: "gitlab",
      list: getGitlabIntegrations,
      remove: deleteGitlabIntegration,
    },
  ] as const)(
    "$id resolves the project's bindings and deletes each by id",
    async ({ id, list, remove }) => {
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const mockedList = vi.mocked(list);
      const mockedRemove = vi.mocked(remove);
      mockedList.mockResolvedValue({
        integrations: [{ id: "binding-1" }, { id: "binding-2" }],
      } as never);
      mockedRemove.mockResolvedValue({ success: true } as never);

      const { result } = renderHook(() => useDisconnectIntegration(id), {
        wrapper: Wrapper,
      });
      await result.current.mutateAsync("p1");

      expect(mockedList).toHaveBeenCalledWith("p1");
      expect(mockedRemove).toHaveBeenCalledTimes(2);
      expect(mockedRemove).toHaveBeenCalledWith("binding-1");
      expect(mockedRemove).toHaveBeenCalledWith("binding-2");
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: [`${id}-integration`, "p1"],
        }),
      );
    },
  );

  it.each([
    { id: "slack", remove: deleteSlackIntegration },
    { id: "discord", remove: deleteDiscordIntegration },
    { id: "mattermost", remove: deleteMattermostIntegration },
    { id: "telegram", remove: deleteTelegramIntegration },
    { id: "webhook", remove: deleteGenericWebhookIntegration },
  ] as const)(
    "$id keeps passing the projectId through",
    async ({ id, remove }) => {
      const mockedRemove = vi.mocked(remove);
      mockedRemove.mockResolvedValue({ success: true } as never);

      const { result } = renderHook(() => useDisconnectIntegration(id), {
        wrapper: Wrapper,
      });
      await result.current.mutateAsync("p1");

      expect(mockedRemove).toHaveBeenCalledWith("p1");
      expect(mockedRemove).toHaveBeenCalledTimes(1);
    },
  );
});
