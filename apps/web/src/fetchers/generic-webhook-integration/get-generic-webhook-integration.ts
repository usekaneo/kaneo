import { getApiUrl } from "@/fetchers/get-api-url";

export type GenericWebhookIntegration = {
  id: string;
  projectId: string;
  webhookConfigured: boolean;
  webhookUrl: string;
  secretConfigured: boolean;
  maskedSecret: string | null;
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
};

async function getGenericWebhookIntegration(
  projectId: string,
): Promise<GenericWebhookIntegration | null> {
  const response = await fetch(
    getApiUrl(`/generic-webhook-integration/project/${projectId}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as GenericWebhookIntegration | null;
}

export default getGenericWebhookIntegration;
