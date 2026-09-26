import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { normalizeGiteaBaseUrl } from "../../plugins/gitea/config";

export async function resolveVerificationToken(input: {
  projectId: string;
  baseUrl: string;
  accessToken?: string;
}) {
  if (input.accessToken?.trim()) return input.accessToken.trim();
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, input.projectId),
      eq(integrationTable.type, "gitea"),
    ),
  });
  let config: { accessToken?: unknown; baseUrl?: unknown } | null = null;
  try {
    config = integration ? JSON.parse(integration.config) : null;
  } catch {
    throw new HTTPException(400, {
      message: "Invalid saved Gitea configuration. Reconnect the integration.",
    });
  }
  // Never forward a stored credential to an edited destination.
  if (
    typeof config?.accessToken !== "string" ||
    !config.accessToken.trim() ||
    typeof config.baseUrl !== "string" ||
    normalizeGiteaBaseUrl(config.baseUrl) !==
      normalizeGiteaBaseUrl(input.baseUrl)
  ) {
    throw new HTTPException(400, {
      message: "Enter a personal access token to verify this Gitea instance.",
    });
  }
  return String(config.accessToken);
}
