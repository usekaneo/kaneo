import {
  formatChannel,
  formatRepository,
  getIntegrationStatus,
} from "@/components/project/integrations/get-integration-status";
import type { IntegrationId } from "@/components/project/integrations/integration-definitions";
import useGetDiscordIntegration from "@/hooks/queries/discord-integration/use-get-discord-integration";
import useGetGenericWebhookIntegration from "@/hooks/queries/generic-webhook-integration/use-get-generic-webhook-integration";
import useGetGiteaIntegration from "@/hooks/queries/gitea-integration/use-get-gitea-integration";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import useGetGitlabIntegration from "@/hooks/queries/gitlab-integration/use-get-gitlab-integration";
import useGetMattermostIntegration from "@/hooks/queries/mattermost-integration/use-get-mattermost-integration";
import useGetSlackIntegration from "@/hooks/queries/slack-integration/use-get-slack-integration";
import useGetTelegramIntegration from "@/hooks/queries/telegram-integration/use-get-telegram-integration";

// Shares query keys with the per-integration settings panels, so opening a
// panel reuses what the list already loaded.
export function useIntegrationStatuses(projectId: string) {
  const github = useGetGithubIntegration(projectId);
  const gitea = useGetGiteaIntegration(projectId);
  const gitlab = useGetGitlabIntegration(projectId);
  const slack = useGetSlackIntegration(projectId);
  const discord = useGetDiscordIntegration(projectId);
  const mattermost = useGetMattermostIntegration(projectId);
  const telegram = useGetTelegramIntegration(projectId);
  const webhook = useGetGenericWebhookIntegration(projectId);

  const statuses = {
    github: getIntegrationStatus({
      queryStatus: github.status,
      hasData: github.data !== undefined,
      configured: Boolean(github.data),
      isActive: github.data?.isActive,
      detail: formatRepository(
        github.data?.repositoryOwner,
        github.data?.repositoryName,
      ),
    }),
    gitea: getIntegrationStatus({
      queryStatus: gitea.status,
      hasData: gitea.data !== undefined,
      configured: Boolean(gitea.data),
      isActive: gitea.data?.isActive,
      detail: formatRepository(
        gitea.data?.repositoryOwner,
        gitea.data?.repositoryName,
      ),
    }),
    gitlab: getIntegrationStatus({
      queryStatus: gitlab.status,
      hasData: gitlab.data !== undefined,
      configured: Boolean(gitlab.data),
      isActive: gitlab.data?.isActive,
      detail: gitlab.data?.projectPath,
    }),
    slack: getIntegrationStatus({
      queryStatus: slack.status,
      hasData: slack.data !== undefined,
      configured: Boolean(slack.data?.webhookConfigured),
      isActive: slack.data?.isActive,
      detail: formatChannel(slack.data?.channelName),
    }),
    discord: getIntegrationStatus({
      queryStatus: discord.status,
      hasData: discord.data !== undefined,
      configured: Boolean(discord.data?.webhookConfigured),
      isActive: discord.data?.isActive,
      detail: formatChannel(discord.data?.channelName),
    }),
    mattermost: getIntegrationStatus({
      queryStatus: mattermost.status,
      hasData: mattermost.data !== undefined,
      configured: Boolean(mattermost.data?.webhookConfigured),
      isActive: mattermost.data?.isActive,
      detail: formatChannel(mattermost.data?.channelName),
    }),
    telegram: getIntegrationStatus({
      queryStatus: telegram.status,
      hasData: telegram.data !== undefined,
      configured: Boolean(telegram.data?.botTokenConfigured),
      isActive: telegram.data?.isActive,
      detail: telegram.data?.chatLabel,
    }),
    webhook: getIntegrationStatus({
      queryStatus: webhook.status,
      hasData: webhook.data !== undefined,
      configured: Boolean(webhook.data?.webhookConfigured),
      isActive: webhook.data?.isActive,
    }),
  };
  const queries = {
    github,
    gitea,
    gitlab,
    slack,
    discord,
    mattermost,
    telegram,
    webhook,
  };

  return {
    statuses,
    retry: (id: IntegrationId) => {
      void queries[id].refetch();
    },
  };
}
