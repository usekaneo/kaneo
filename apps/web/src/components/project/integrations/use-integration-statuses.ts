import {
  formatChannel,
  formatRepository,
  getIntegrationStatus,
  type IntegrationStatus,
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
export function useIntegrationStatuses(
  projectId: string,
  enabled: boolean,
): Partial<Record<IntegrationId, IntegrationStatus>> {
  const options = { enabled };
  const { data: github } = useGetGithubIntegration(projectId, options);
  const { data: gitea } = useGetGiteaIntegration(projectId, options);
  const { data: gitlab } = useGetGitlabIntegration(projectId, options);
  const { data: slack } = useGetSlackIntegration(projectId, options);
  const { data: discord } = useGetDiscordIntegration(projectId, options);
  const { data: mattermost } = useGetMattermostIntegration(projectId, options);
  const { data: telegram } = useGetTelegramIntegration(projectId, options);
  const { data: webhook } = useGetGenericWebhookIntegration(projectId, options);

  if (!enabled) return {};

  return {
    github: getIntegrationStatus({
      configured: Boolean(github),
      isActive: github?.isActive,
      detail: formatRepository(github?.repositoryOwner, github?.repositoryName),
    }),
    gitea: getIntegrationStatus({
      configured: Boolean(gitea),
      isActive: gitea?.isActive,
      detail: formatRepository(gitea?.repositoryOwner, gitea?.repositoryName),
    }),
    gitlab: getIntegrationStatus({
      configured: Boolean(gitlab),
      isActive: gitlab?.isActive,
      detail: gitlab?.projectPath,
    }),
    slack: getIntegrationStatus({
      configured: Boolean(slack?.webhookConfigured),
      isActive: slack?.isActive,
      detail: formatChannel(slack?.channelName),
    }),
    discord: getIntegrationStatus({
      configured: Boolean(discord?.webhookConfigured),
      isActive: discord?.isActive,
      detail: formatChannel(discord?.channelName),
    }),
    mattermost: getIntegrationStatus({
      configured: Boolean(mattermost?.webhookConfigured),
      isActive: mattermost?.isActive,
      detail: formatChannel(mattermost?.channelName),
    }),
    telegram: getIntegrationStatus({
      configured: Boolean(telegram?.botTokenConfigured),
      isActive: telegram?.isActive,
      detail: telegram?.chatLabel,
    }),
    webhook: getIntegrationStatus({
      configured: Boolean(webhook?.webhookConfigured),
      isActive: webhook?.isActive,
    }),
  };
}
