import * as Sentry from "@sentry/node";
import { sendOutboundRequest } from "../../utils/outbound-request";

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

export async function postToSlack(
  webhookUrl: string,
  message: SlackMessage,
): Promise<void> {
  Sentry.addBreadcrumb({
    category: "integration",
    level: "info",
    data: { integration: "slack" },
  });
  await sendOutboundRequest(webhookUrl, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}
