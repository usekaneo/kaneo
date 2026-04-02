import { lookup } from "node:dns/promises";
import net from "node:net";
import * as v from "valibot";

function isDisallowedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isDisallowedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

function isDisallowedAddress(address: string): boolean {
  if (address === "localhost") {
    return true;
  }

  const version = net.isIP(address);
  if (version === 4) {
    return isDisallowedIpv4(address);
  }

  if (version === 6) {
    return isDisallowedIpv6(address);
  }

  return false;
}

export async function assertPublicWebhookDestination(
  webhookUrl: string,
): Promise<void> {
  const url = new URL(webhookUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Generic webhook URL must use http or https");
  }

  if (isDisallowedAddress(url.hostname)) {
    throw new Error(
      "Generic webhook destination resolves to a non-routable address",
    );
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Generic webhook destination could not be resolved");
  }

  if (addresses.some((entry) => isDisallowedAddress(entry.address))) {
    throw new Error(
      "Generic webhook destination resolves to a non-routable address",
    );
  }
}

export const genericWebhookEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type GenericWebhookEventKey = (typeof genericWebhookEventKeys)[number];

export const genericWebhookConfigSchema = v.object({
  webhookUrl: v.pipe(
    v.string(),
    v.url(),
    v.check((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Webhook URL must use http or https"),
  ),
  secret: v.optional(v.string()),
  health: v.optional(
    v.object({
      lastSuccessAt: v.optional(v.string()),
      lastFailureAt: v.optional(v.string()),
      lastFailureMessage: v.optional(v.string()),
      failureCount: v.optional(v.number()),
      lastAttempt: v.optional(
        v.object({
          eventName: v.string(),
          taskId: v.string(),
          projectId: v.string(),
          webhookUrl: v.string(),
        }),
      ),
    }),
  ),
  events: v.optional(
    v.object({
      taskCreated: v.optional(v.boolean()),
      taskStatusChanged: v.optional(v.boolean()),
      taskPriorityChanged: v.optional(v.boolean()),
      taskTitleChanged: v.optional(v.boolean()),
      taskDescriptionChanged: v.optional(v.boolean()),
      taskCommentCreated: v.optional(v.boolean()),
    }),
  ),
});

export type GenericWebhookConfig = v.InferOutput<
  typeof genericWebhookConfigSchema
>;

export const defaultGenericWebhookEvents: Record<
  GenericWebhookEventKey,
  boolean
> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function normalizeGenericWebhookConfig(
  config: GenericWebhookConfig,
): GenericWebhookConfig {
  const secret =
    typeof config.secret === "string"
      ? config.secret.trim() || undefined
      : undefined;

  return {
    ...config,
    secret,
    health: config.health
      ? {
          ...config.health,
          failureCount: config.health.failureCount ?? 0,
        }
      : undefined,
    events: {
      ...defaultGenericWebhookEvents,
      ...(config.events ?? {}),
    },
  };
}

export async function validateGenericWebhookConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    const parsed = v.parse(genericWebhookConfigSchema, config);
    await assertPublicWebhookDestination(parsed.webhookUrl);
    return { valid: true };
  } catch (error) {
    if (error instanceof v.ValiError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => issue.message),
      };
    }

    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid config"],
    };
  }
}
