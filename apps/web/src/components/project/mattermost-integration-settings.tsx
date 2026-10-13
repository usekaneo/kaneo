import { mattermostChatProvider } from "@/components/project/integrations/chat-webhook/chat-webhook-providers";
import { ChatWebhookSettings } from "@/components/project/integrations/chat-webhook/chat-webhook-settings";

export function MattermostIntegrationSettings({
  projectId,
}: {
  projectId: string;
}) {
  return (
    <ChatWebhookSettings
      projectId={projectId}
      provider={mattermostChatProvider}
    />
  );
}
