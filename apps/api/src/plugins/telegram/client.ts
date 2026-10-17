import * as Sentry from "@sentry/node";
import {
  OutboundRequestError,
  sendOutboundRequest,
} from "../../utils/outbound-request";
import { assertTelegramTransport, TELEGRAM_API_URL } from "./config";

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
  serverUrl?: string,
): Promise<void> {
  Sentry.addBreadcrumb({
    category: "integration",
    level: "info",
    data: { integration: "telegram" },
  });
  if (serverUrl) {
    try {
      assertTelegramTransport(serverUrl);
    } catch {
      throw new OutboundRequestError("destination");
    }
  }
  const result = await sendOutboundRequest(
    `${serverUrl ?? TELEGRAM_API_URL}/bot${botToken}/sendMessage`,
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    },
    { readJson: true, publicDestination: Boolean(serverUrl) },
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
