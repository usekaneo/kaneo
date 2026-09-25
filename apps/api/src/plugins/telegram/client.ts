import * as Sentry from "@sentry/node";
import {
  OutboundRequestError,
  sendOutboundRequest,
} from "../../utils/outbound-request";

type TelegramMessage = {
  chat_id: string;
  text: string;
  parse_mode?: "HTML";
  disable_web_page_preview?: boolean;
  message_thread_id?: number;
};

export async function postToTelegram(
  botToken: string,
  message: TelegramMessage,
): Promise<void> {
  Sentry.addBreadcrumb({
    category: "integration",
    level: "info",
    data: { integration: "telegram" },
  });
  const result = await sendOutboundRequest(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    },
    { readJson: true },
  );
  if (
    !result ||
    typeof result !== "object" ||
    !("ok" in result) ||
    result.ok !== true
  ) {
    throw new OutboundRequestError("response");
  }
}
