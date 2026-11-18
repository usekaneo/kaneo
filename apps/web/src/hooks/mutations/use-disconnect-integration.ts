import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IntegrationId } from "@/components/project/integrations/integration-definitions";
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

// The disconnect screen works per project, but repository integrations are
// stored as one binding per repository and their delete endpoint is keyed by
// integration id. For github, gitea and gitlab the mutation therefore loads the
// project's bindings through the list endpoint and deletes each binding by its
// own id; chat integrations keep their single project-keyed delete route.
async function disconnectGithubProject(projectId: string) {
  const { integrations } = await getGithubIntegrations(projectId);
  await Promise.all(
    integrations.map((integration) => deleteGithubIntegration(integration.id)),
  );
}

async function disconnectGiteaProject(projectId: string) {
  const { integrations } = await getGiteaIntegrations(projectId);
  await Promise.all(
    integrations.map((integration) => deleteGiteaIntegration(integration.id)),
  );
}

async function disconnectGitlabProject(projectId: string) {
  const { integrations } = await getGitlabIntegrations(projectId);
  await Promise.all(
    integrations.map((integration) => deleteGitlabIntegration(integration.id)),
  );
}

const disconnect = {
  github: disconnectGithubProject,
  gitea: disconnectGiteaProject,
  gitlab: disconnectGitlabProject,
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
