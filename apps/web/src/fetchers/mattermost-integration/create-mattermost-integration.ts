import { getApiUrl } from "@/fetchers/get-api-url";
import type { MattermostIntegration } from "./get-mattermost-integration";

export type CreateMattermostIntegrationRequest = {
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

async function createMattermostIntegration(
  projectId: string,
  json: CreateMattermostIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/mattermost-integration/project/${projectId}`),
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

  return (await response.json()) as MattermostIntegration;
}

export default createMattermostIntegration;
