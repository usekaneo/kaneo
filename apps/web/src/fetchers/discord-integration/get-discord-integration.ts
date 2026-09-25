import { getApiUrl } from "@/fetchers/get-api-url";

import { HttpError } from "@/lib/http-error";
export type DiscordIntegration = {
  id: string;
  projectId: string;
  channelName: string | null;
  webhookConfigured: boolean;
  maskedWebhookUrl: string;
  events: {
    taskCreated: boolean;
    taskStatusChanged: boolean;
    taskPriorityChanged: boolean;
    taskTitleChanged: boolean;
    taskDescriptionChanged: boolean;
    taskCommentCreated: boolean;
  };
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
} | null;

async function getDiscordIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/discord-integration/project/${projectId}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return (await response.json()) as DiscordIntegration;
}

export default getDiscordIntegration;
