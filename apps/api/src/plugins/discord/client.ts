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

export async function postToDiscord(
  webhookUrl: string,
  message: DiscordMessage,
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
      `Discord webhook request failed (${response.status}): ${errorText}`,
    );
  }
}
