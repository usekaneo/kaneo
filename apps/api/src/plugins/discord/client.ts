import * as Sentry from "@sentry/node";
import { sendOutboundRequest } from "../../utils/outbound-request";

type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: {
    text: string;
  };
};

type DiscordMessage = {
  content?: string;
  embeds?: DiscordEmbed[];
};

export function sanitizeDiscordContent(value: string): string {
  return value
    .replace(/@everyone/g, "@\u200beveryone")
    .replace(/@here/g, "@\u200bhere")
    .replace(/<@&/g, "<@\u200b&")
    .replace(/<@!?\d+>/g, (match) => `<@\u200b${match.slice(2)}`)
    .replace(/<#\d+>/g, (match) => `<#\u200b${match.slice(2)}`)
    .replace(/<:\w+:\d+>/g, (match) => `<:\u200b${match.slice(2)}`)
    .replace(/<a:\w+:\d+>/g, (match) => `<a:\u200b${match.slice(3)}`);
}

export async function postToDiscord(
  webhookUrl: string,
  message: DiscordMessage,
): Promise<void> {
  Sentry.addBreadcrumb({
    category: "integration",
    level: "info",
    data: { integration: "discord" },
  });
  await sendOutboundRequest(webhookUrl, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}
