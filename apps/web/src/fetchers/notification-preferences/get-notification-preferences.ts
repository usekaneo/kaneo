import { getApiUrl } from "@/fetchers/get-api-url";

export type NotificationPreferenceWorkspaceRule = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  isActive: boolean;
  emailEnabled: boolean;
  ntfyEnabled: boolean;
  webhookEnabled: boolean;
  projectMode: "all" | "selected";
  selectedProjectIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferences = {
  emailAddress: string | null;
  emailEnabled: boolean;
  ntfyEnabled: boolean;
  ntfyConfigured: boolean;
  ntfyServerUrl: string | null;
  ntfyTopic: string | null;
  ntfyTokenConfigured: boolean;
  maskedNtfyToken: string | null;
  webhookEnabled: boolean;
  webhookConfigured: boolean;
  webhookUrl: string | null;
  webhookSecretConfigured: boolean;
  maskedWebhookSecret: string | null;
  workspaces: NotificationPreferenceWorkspaceRule[];
  createdAt: string | null;
  updatedAt: string | null;
};

async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch(getApiUrl("/notification-preferences"), {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as NotificationPreferences;
}

export default getNotificationPreferences;
