import { getApiUrl } from "@/fetchers/get-api-url";

export type GoogleChatIntegration = {
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

async function getGoogleChatIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/google-chat-integration/project/${projectId}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as GoogleChatIntegration;
}

export default getGoogleChatIntegration;
