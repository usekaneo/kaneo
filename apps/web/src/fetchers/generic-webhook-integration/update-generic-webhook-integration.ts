import { getApiUrl } from "@/fetchers/get-api-url";
import type { GenericWebhookIntegration } from "./get-generic-webhook-integration";

export type UpdateGenericWebhookIntegrationRequest = {
  webhookUrl?: string;
  secret?: string | null;
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

async function updateGenericWebhookIntegration(
  projectId: string,
  json: UpdateGenericWebhookIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/generic-webhook-integration/project/${projectId}`),
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

  return (await response.json()) as GenericWebhookIntegration;
}

export default updateGenericWebhookIntegration;
