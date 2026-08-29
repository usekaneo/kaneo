import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultTelegramEvents,
  normalizeTelegramConfig,
  type TelegramConfig,
  type TelegramEventKey,
  telegramConfigSchema,
} from "../../plugins/telegram/config";

// The HTTP body is validated by updateTelegramBody in ../schema; this is the
// shape it produces. Every event toggle is genuinely optional -- a patch merges
// the toggles it carries over the stored ones and leaves the rest alone.
export type TelegramIntegrationPatchBody = {
  botToken?: string;
  chatId?: string;
  threadId?: number | null;
  chatLabel?: string | null;
  isActive?: boolean;
  events?: Partial<Record<TelegramEventKey, boolean>>;
};

export function buildNextTelegramConfigFromPatch(
  body: TelegramIntegrationPatchBody,
  currentConfig: TelegramConfig,
): TelegramConfig {
  const nextBotToken =
    "botToken" in body ? (body.botToken?.trim() ?? "") : currentConfig.botToken;
  const nextChatId =
    "chatId" in body ? (body.chatId?.trim() ?? "") : currentConfig.chatId;
  return {
    botToken: nextBotToken,
    chatId: nextChatId,
    threadId:
      body.threadId === undefined
        ? currentConfig.threadId
        : (body.threadId ?? undefined),
    chatLabel:
      body.chatLabel === undefined
        ? currentConfig.chatLabel
        : (body.chatLabel ?? undefined),
    events: {
      ...defaultTelegramEvents,
      ...(currentConfig.events ?? {}),
      ...(body.events ?? {}),
    },
  };
}

function maskBotToken(value: string): string {
  const [prefix, suffix = ""] = value.split(":", 2);
  if (!suffix) {
    return "Configured";
  }

  const maskedSuffix =
    suffix.length > 8 ? `${suffix.slice(0, 4)}…${suffix.slice(-4)}` : "••••";
  return `${prefix}:${maskedSuffix}`;
}

function sanitizeTelegramConfigForLog(rawConfig: string): string {
  try {
    const parsed = JSON.parse(rawConfig) as Record<string, unknown>;
    for (const key of [
      "botToken",
      "chatId",
      "threadId",
      "chatLabel",
    ] as const) {
      if (key in parsed) {
        parsed[key] = "[REDACTED]";
      }
    }
    return JSON.stringify(parsed);
  } catch {
    return "[UNPARSEABLE]";
  }
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
      sanitizedConfig: sanitizeTelegramConfigForLog(integration.config),
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
