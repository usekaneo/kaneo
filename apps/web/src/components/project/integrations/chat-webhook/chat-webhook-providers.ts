import {
  useCreateDiscordIntegration,
  useDeleteDiscordIntegration,
  useUpdateDiscordIntegration,
} from "@/hooks/mutations/discord-integration/use-discord-integration";
import {
  useCreateMattermostIntegration,
  useDeleteMattermostIntegration,
  useUpdateMattermostIntegration,
} from "@/hooks/mutations/mattermost-integration/use-mattermost-integration";
import {
  useCreateSlackIntegration,
  useDeleteSlackIntegration,
  useUpdateSlackIntegration,
} from "@/hooks/mutations/slack-integration/use-slack-integration";
import useGetDiscordIntegration from "@/hooks/queries/discord-integration/use-get-discord-integration";
import useGetMattermostIntegration from "@/hooks/queries/mattermost-integration/use-get-mattermost-integration";
import useGetSlackIntegration from "@/hooks/queries/slack-integration/use-get-slack-integration";
import type { ChatWebhookProvider } from "./chat-webhook-provider";

export const slackChatProvider: ChatWebhookProvider = {
  name: "Slack",
  webhookUrlPattern:
    /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/i,
  emptyChannelName: undefined,
  keys: {
    webhookPlaceholder: "settings:slackIntegration.webhookPlaceholder",
    webhookHint: "settings:slackIntegration.webhookHint",
    webhookInvalid: "settings:slackIntegration.validation.webhookInvalid",
    connect: "settings:slackIntegration.connect",
    saved: "settings:slackIntegration.toast.saved",
    saveError: "settings:slackIntegration.toast.saveError",
    enabled: "settings:slackIntegration.toast.enabled",
    disabled: "settings:slackIntegration.toast.disabled",
    updateError: "settings:slackIntegration.toast.updateError",
    removed: "settings:slackIntegration.toast.removed",
    removeError: "settings:slackIntegration.toast.removeError",
  },
  useIntegration: useGetSlackIntegration,
  useCreateIntegration: useCreateSlackIntegration,
  useUpdateIntegration: useUpdateSlackIntegration,
  useDeleteIntegration: useDeleteSlackIntegration,
};

export const discordChatProvider: ChatWebhookProvider = {
  name: "Discord",
  webhookUrlPattern:
    /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[^/]+\/[^/\s]+$/i,
  emptyChannelName: undefined,
  keys: {
    webhookPlaceholder: "settings:discordIntegration.webhookPlaceholder",
    webhookHint: "settings:discordIntegration.webhookHint",
    webhookInvalid: "settings:discordIntegration.validation.webhookInvalid",
    connect: "settings:discordIntegration.connect",
    saved: "settings:discordIntegration.toast.saved",
    saveError: "settings:discordIntegration.toast.saveError",
    enabled: "settings:discordIntegration.toast.enabled",
    disabled: "settings:discordIntegration.toast.disabled",
    updateError: "settings:discordIntegration.toast.updateError",
    removed: "settings:discordIntegration.toast.removed",
    removeError: "settings:discordIntegration.toast.removeError",
  },
  useIntegration: useGetDiscordIntegration,
  useCreateIntegration: useCreateDiscordIntegration,
  useUpdateIntegration: useUpdateDiscordIntegration,
  useDeleteIntegration: useDeleteDiscordIntegration,
};

export const mattermostChatProvider: ChatWebhookProvider = {
  name: "Mattermost",
  webhookUrlPattern: /^https:\/\/.+/,
  emptyChannelName: null,
  keys: {
    webhookPlaceholder: "settings:mattermostIntegration.webhookPlaceholder",
    webhookHint: "settings:mattermostIntegration.webhookHint",
    webhookInvalid: "settings:mattermostIntegration.validation.webhookInvalid",
    connect: "settings:mattermostIntegration.connect",
    saved: "settings:mattermostIntegration.toast.saved",
    saveError: "settings:mattermostIntegration.toast.saveError",
    enabled: "settings:mattermostIntegration.toast.enabled",
    disabled: "settings:mattermostIntegration.toast.disabled",
    updateError: "settings:mattermostIntegration.toast.updateError",
    removed: "settings:mattermostIntegration.toast.removed",
    removeError: "settings:mattermostIntegration.toast.removeError",
  },
  useIntegration: useGetMattermostIntegration,
  useCreateIntegration: useCreateMattermostIntegration,
  useUpdateIntegration: useUpdateMattermostIntegration,
  useDeleteIntegration: useDeleteMattermostIntegration,
};
