import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  assertTelegramTransport,
  defaultTelegramEvents,
  normalizeTelegramConfig,
  type TelegramConfig,
  type TelegramEventKey,
  telegramConfigSchema,
  validateTelegramConfig,
} from "../../plugins/telegram/config";

// The HTTP body is validated by updateTelegramBody in ../schema; this is the
// shape it produces. Every event toggle is genuinely optional -- a patch merges
// the toggles it carries over the stored ones and leaves the rest alone.
export type TelegramIntegrationPatchBody = {
  botToken?: string;
  serverUrl?: string | null;
  expectedServerUrl?: string | null;
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
    serverUrl:
      body.serverUrl === undefined
        ? currentConfig.serverUrl
        : (body.serverUrl ?? undefined),
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
      ...currentConfig.events,
      ...body.events,
    },
  };
}

// Saved bot token is only authorized for the server it was entered for
export function assertTelegramServerChange(
  nextConfig: TelegramConfig,
  currentConfig: TelegramConfig | null,
  tokenSupplied: boolean,
): void {
  if (nextConfig.serverUrl === currentConfig?.serverUrl) {
    return;
  }

  if (currentConfig && !tokenSupplied) {
    throw new HTTPException(400, {
      message: "Enter the bot token again when changing the Bot API server URL",
    });
  }

  if (nextConfig.serverUrl) {
    try {
      assertTelegramTransport(nextConfig.serverUrl);
    } catch (error) {
      throw new HTTPException(400, {
        message:
          error instanceof Error ? error.message : "Invalid Bot API server URL",
      });
    }
  }
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
    serverUrl: config.serverUrl ?? null,
    chatId: config.chatId,
    threadId: config.threadId ?? null,
    chatLabel: config.chatLabel ?? null,
    botTokenConfigured: Boolean(config.botToken),
    maskedBotToken: config.botToken ? maskBotToken(config.botToken) : "",
    events: {
      ...defaultTelegramEvents,
      ...config.events,
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

export async function updateTelegramIntegration(
  projectId: string,
  body: TelegramIntegrationPatchBody,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(integrationTable)
      .where(
        and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "telegram"),
        ),
      )
      .for("update");

    if (!existing) {
      throw new HTTPException(404, {
        message: "Telegram integration not found",
      });
    }

    const currentConfig = parseTelegramIntegrationConfig(existing);
    if (
      body.expectedServerUrl !== undefined &&
      body.expectedServerUrl !== (currentConfig.serverUrl ?? null)
    ) {
      throw new HTTPException(409, {
        message:
          "The Bot API server URL changed. Reload settings and try again.",
      });
    }

    const nextConfig = normalizeTelegramConfig(
      buildNextTelegramConfigFromPatch(body, currentConfig),
    );
    const isActive = body.isActive ?? existing.isActive ?? true;

    if (
      JSON.stringify(currentConfig) === JSON.stringify(nextConfig) &&
      isActive === (existing.isActive ?? true)
    ) {
      return { integration: toResponse(existing), changed: false };
    }

    const validation = validateTelegramConfig(nextConfig);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }
    assertTelegramServerChange(
      nextConfig,
      currentConfig,
      Boolean(body.botToken?.trim()),
    );

    const [updated] = await tx
      .update(integrationTable)
      .set({
        config: JSON.stringify(nextConfig),
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(integrationTable.id, existing.id))
      .returning();

    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to load Telegram integration after update",
      });
    }

    return { integration: toResponse(updated), changed: true };
  });
}
