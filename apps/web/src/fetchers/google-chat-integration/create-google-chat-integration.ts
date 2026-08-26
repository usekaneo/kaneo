import { getApiUrl } from "@/fetchers/get-api-url";
import type { GoogleChatIntegration } from "./get-google-chat-integration";

export type CreateGoogleChatIntegrationRequest = {
  webhookUrl: string;
  channelName?: string;
  events?: {
    taskCreated?: boolean;
    taskStatusChanged?: boolean;
    taskPriorityChanged?: boolean;
    taskTitleChanged?: boolean;
    taskDescriptionChanged?: boolean;
    taskCommentCreated?: boolean;
  };
};

async function createGoogleChatIntegration(
  projectId: string,
  json: CreateGoogleChatIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/google-chat-integration/project/${projectId}`),
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as GoogleChatIntegration;
}

export default createGoogleChatIntegration;
