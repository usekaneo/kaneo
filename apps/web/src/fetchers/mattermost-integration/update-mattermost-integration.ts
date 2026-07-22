import { getApiUrl } from "@/fetchers/get-api-url";
import type { MattermostIntegration } from "./get-mattermost-integration";

export type UpdateMattermostIntegrationRequest = {
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

async function updateMattermostIntegration(
  projectId: string,
  json: UpdateMattermostIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/mattermost-integration/project/${projectId}`),
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

  return (await response.json()) as MattermostIntegration;
}

export default updateMattermostIntegration;
