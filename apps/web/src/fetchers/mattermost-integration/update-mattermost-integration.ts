import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";
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
    throw new HttpError(response.status, await response.text());
  }

  return (await response.json()) as MattermostIntegration;
}

export default updateMattermostIntegration;
