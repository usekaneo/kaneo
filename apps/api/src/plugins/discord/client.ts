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

const DISCORD_TIMEOUT_MS = 10_000;

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

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
        `Discord webhook request failed (${response.status}): ${errorText}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Discord webhook request timed out after ${DISCORD_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
