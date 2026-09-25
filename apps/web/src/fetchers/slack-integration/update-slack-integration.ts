import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";
import type { SlackIntegration } from "./get-slack-integration";

export type UpdateSlackIntegrationRequest = {
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

async function updateSlackIntegration(
  projectId: string,
  json: UpdateSlackIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/slack-integration/project/${projectId}`),
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

  return (await response.json()) as SlackIntegration;
}

export default updateSlackIntegration;
