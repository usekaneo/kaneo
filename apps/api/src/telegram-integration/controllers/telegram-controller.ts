import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultTelegramEvents,
  normalizeTelegramConfig,
  type TelegramConfig,
  telegramConfigSchema,
} from "../../plugins/telegram/config";

function maskBotToken(value: string): string {
  const [prefix, suffix = ""] = value.split(":", 2);
  if (!suffix) {
    return "Configured";
  }

  const maskedSuffix =
    suffix.length > 8 ? `${suffix.slice(0, 4)}…${suffix.slice(-4)}` : "••••";
  return `${prefix}:${maskedSuffix}`;
}

type TelegramIntegrationRecord = {
  id: string;
  projectId: string;
  config: string;
  isActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

export function parseTelegramIntegrationConfig(
  integration: Pick<TelegramIntegrationRecord, "config" | "id" | "projectId">,
): TelegramConfig {
  try {
    const parsed = v.parse(
      telegramConfigSchema,
      JSON.parse(integration.config),
    );
    return normalizeTelegramConfig(parsed);
  } catch (error) {
    console.error("Failed to parse Telegram integration config", {
      error,
      integrationId: integration.id,
      projectId: integration.projectId,
      rawConfig: integration.config,
    });
    throw new HTTPException(500, {
      message: "Stored Telegram integration configuration is invalid",
    });
  }
}

export function toResponse(integration: TelegramIntegrationRecord) {
  const config = parseTelegramIntegrationConfig(integration);

  return {
    id: integration.id,
    projectId: integration.projectId,
    chatId: config.chatId,
    threadId: config.threadId ?? null,
    chatLabel: config.chatLabel ?? null,
    botTokenConfigured: Boolean(config.botToken),
    maskedBotToken: config.botToken ? maskBotToken(config.botToken) : "",
    events: {
      ...defaultTelegramEvents,
      ...(config.events ?? {}),
    },
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export async function getTelegramIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "telegram"),
    ),
  });

  if (!integration) {
    return null;
  }

  return toResponse(integration);
}
