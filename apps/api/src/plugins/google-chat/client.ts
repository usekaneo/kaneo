import * as Sentry from "@sentry/node";

export type GoogleChatMessage = {
  text: string;
};

const GOOGLE_CHAT_TIMEOUT_MS = 10_000;

export async function postToGoogleChat(
  webhookUrl: string,
  message: GoogleChatMessage,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GOOGLE_CHAT_TIMEOUT_MS,
  );

  try {
    Sentry.addBreadcrumb({
      category: "integration",
      level: "info",
      data: { integration: "google-chat" },
    });
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GoogleChat webhook request failed (${response.status}): ${errorText}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `GoogleChat webhook request timed out after ${GOOGLE_CHAT_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
