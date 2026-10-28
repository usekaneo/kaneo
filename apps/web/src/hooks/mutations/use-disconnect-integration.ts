import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IntegrationId } from "@/components/project/integrations/integration-definitions";
import deleteDiscordIntegration from "@/fetchers/discord-integration/delete-discord-integration";
import deleteGenericWebhookIntegration from "@/fetchers/generic-webhook-integration/delete-generic-webhook-integration";
import deleteGiteaIntegration from "@/fetchers/gitea-integration/delete-gitea-integration";
import deleteGithubIntegration from "@/fetchers/github-integration/delete-github-integration";
import deleteGitlabIntegration from "@/fetchers/gitlab-integration/delete-gitlab-integration";
import deleteMattermostIntegration from "@/fetchers/mattermost-integration/delete-mattermost-integration";
import deleteSlackIntegration from "@/fetchers/slack-integration/delete-slack-integration";
import deleteTelegramIntegration from "@/fetchers/telegram-integration/delete-telegram-integration";

const disconnect = {
  github: deleteGithubIntegration,
  gitea: deleteGiteaIntegration,
  gitlab: deleteGitlabIntegration,
  slack: deleteSlackIntegration,
  discord: deleteDiscordIntegration,
  mattermost: deleteMattermostIntegration,
  telegram: deleteTelegramIntegration,
  webhook: deleteGenericWebhookIntegration,
};

export function useDisconnectIntegration(id: IntegrationId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      await disconnect[id](projectId);
    },
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: [
          `${id === "webhook" ? "generic-webhook" : id}-integration`,
          projectId,
        ],
      });
    },
  });
}
