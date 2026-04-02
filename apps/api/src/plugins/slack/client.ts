export type SlackTextObject = {
  type: "mrkdwn" | "plain_text";
  text: string;
};

export type SlackBlock =
  | {
      type: "section";
      text: SlackTextObject;
      fields?: SlackTextObject[];
    }
  | {
      type: "context";
      elements: SlackTextObject[];
    };

export type SlackMessage = {
  text: string;
  blocks?: SlackBlock[];
};

const SLACK_TIMEOUT_MS = 10_000;

export async function postToSlack(
  webhookUrl: string,
  message: SlackMessage,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);

  try {
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
        `Slack webhook request failed (${response.status}): ${errorText}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Slack webhook request timed out after ${SLACK_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
