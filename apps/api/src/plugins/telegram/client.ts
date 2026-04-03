type TelegramMessage = {
  chat_id: string;
  text: string;
  parse_mode?: "HTML";
  disable_web_page_preview?: boolean;
  message_thread_id?: number;
};

const TELEGRAM_TIMEOUT_MS = 10_000;

export async function postToTelegram(
  botToken: string,
  message: TelegramMessage,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Telegram request failed (${response.status}): ${errorText}`,
      );
    }

    const result = (await response.json()) as {
      ok?: boolean;
      description?: string;
    };

    if (!result.ok) {
      throw new Error(result.description || "Telegram API request failed");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Telegram request timed out after ${TELEGRAM_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
