export type MattermostAttachment = {
  color?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
};

export type MattermostMessage = {
  text: string;
  attachments?: MattermostAttachment[];
};

const MATTERMOST_TIMEOUT_MS = 10_000;

export async function postToMattermost(
  webhookUrl: string,
  message: MattermostMessage,
): Promise<void> {
  await assertPublicWebhookDestination(webhookUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MATTERMOST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mattermost webhook request failed (${response.status}): ${errorText}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Mattermost webhook request timed out after ${MATTERMOST_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

import { assertPublicWebhookDestination } from "../generic-webhook/config";
