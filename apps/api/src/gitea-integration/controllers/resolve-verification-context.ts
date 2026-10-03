import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  type GiteaIssueSyncMode,
  normalizeGiteaBaseUrl,
} from "../../plugins/gitea/config";

export async function resolveVerificationContext(input: {
  projectId: string;
  baseUrl: string;
  accessToken?: string;
  issueSyncMode?: GiteaIssueSyncMode;
}) {
  let baseUrl: string;
  try {
    baseUrl = normalizeGiteaBaseUrl(input.baseUrl);
  } catch {
    throw new HTTPException(400, {
      message:
        "Enter a valid HTTP or HTTPS Gitea URL without credentials, a query, or a fragment.",
    });
  }
  const suppliedToken = input.accessToken?.trim();
  if (suppliedToken && input.issueSyncMode !== undefined) {
    return { accessToken: suppliedToken, issueSyncMode: input.issueSyncMode };
  }
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, input.projectId),
      eq(integrationTable.type, "gitea"),
    ),
  });
  const invalidConfig = () =>
    new HTTPException(400, {
      message: "Invalid saved Gitea configuration. Reconnect the integration.",
    });
  let config: Record<string, unknown> | undefined;
  if (integration) {
    try {
      const parsed: unknown = JSON.parse(integration.config);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw invalidConfig();
      config = parsed as Record<string, unknown>;
    } catch {
      throw invalidConfig();
    }
  }
  let issueSyncMode = input.issueSyncMode;
  if (issueSyncMode === undefined) {
    const savedMode = config?.issueSyncMode;
    if (
      savedMode !== undefined &&
      savedMode !== "sync" &&
      savedMode !== "ingest-only" &&
      savedMode !== "off"
    )
      throw invalidConfig();
    issueSyncMode = savedMode ?? "sync";
  }
  if (suppliedToken) return { accessToken: suppliedToken, issueSyncMode };
  if (
    config &&
    (typeof config.baseUrl !== "string" ||
      typeof config.accessToken !== "string" ||
      !config.accessToken.trim())
  )
    throw invalidConfig();
  let savedBaseUrl: string | undefined;
  if (config) {
    try {
      savedBaseUrl = normalizeGiteaBaseUrl(config.baseUrl as string);
    } catch {
      throw invalidConfig();
    }
  }
  // Never forward a stored credential to an edited destination.
  if (!config || savedBaseUrl !== baseUrl) {
    throw new HTTPException(400, {
      message: "Enter a personal access token to verify this Gitea instance.",
    });
  }
  return { accessToken: (config.accessToken as string).trim(), issueSyncMode };
}
