type SlackTextObject = {
  type: "mrkdwn" | "plain_text";
  text: string;
};

type SlackBlock =
  | {
      type: "section";
      text: SlackTextObject;
      fields?: SlackTextObject[];
    }
  | {
      type: "context";
      elements: SlackTextObject[];
    };

type SlackMessage = {
  text: string;
  blocks?: SlackBlock[];
};

export async function postToSlack(
  webhookUrl: string,
  message: SlackMessage,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Slack webhook request failed (${response.status}): ${errorText}`,
    );
  }
}
