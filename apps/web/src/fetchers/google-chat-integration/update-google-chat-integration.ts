import { getApiUrl } from "@/fetchers/get-api-url";
import type { GoogleChatIntegration } from "./get-google-chat-integration";

export type UpdateGoogleChatIntegrationRequest = {
  webhookUrl?: string;
  channelName?: string | null;
  isActive?: boolean;
  events?: {
    taskCreated?: boolean;
    taskStatusChanged?: boolean;
    taskPriorityChanged?: boolean;
    taskTitleChanged?: boolean;
    taskDescriptionChanged?: boolean;
    taskCommentCreated?: boolean;
  };
};

async function updateGoogleChatIntegration(
  projectId: string,
  json: UpdateGoogleChatIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/google-chat-integration/project/${projectId}`),
    {
      method: "PATCH",
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

export default updateGoogleChatIntegration;
