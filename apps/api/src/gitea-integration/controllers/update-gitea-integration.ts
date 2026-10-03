import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  type GiteaConfig,
  type GiteaIssueSyncMode,
  getGiteaIssueSyncMode,
  giteaConfigSchema,
} from "../../plugins/gitea/config";
import { retireGiteaIssueEdits } from "../../plugins/gitea/services/retire-issue-edits";
import getGiteaIntegration from "./get-gitea-integration";
import verifyGiteaAccess from "./verify-gitea-access";

function parseConfig(value: string): GiteaConfig {
  try {
    const config: unknown = JSON.parse(value);
    return v.parse(giteaConfigSchema, config);
  } catch {
    throw new HTTPException(400, {
      message: "Invalid saved Gitea configuration. Reconnect the integration.",
    });
  }
}

export default async function updateGiteaIntegration(
  projectId: string,
  body: {
    commentTaskLinkOnGiteaIssue?: boolean;
    issueSyncMode?: GiteaIssueSyncMode;
    isActive?: boolean;
  },
) {
  const where = and(
    eq(integrationTable.projectId, projectId),
    eq(integrationTable.type, "gitea"),
  );
  const snapshot = await db.query.integrationTable.findFirst({ where });
  if (!snapshot) return null;
  const previous = parseConfig(snapshot.config);
  if (
    body.issueSyncMode === "sync" &&
    getGiteaIssueSyncMode(previous) !== "sync"
  ) {
    const result = await verifyGiteaAccess({
      ...previous,
      issueSyncMode: "sync",
    });
    if (
      !result.hasRequiredPermissions ||
      !result.repositoryExists ||
      !result.isInstalled
    ) {
      throw new HTTPException(400, { message: result.message });
    }
  }
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(integrationTable)
      .where(where)
      .for("update");
    if (
      !row ||
      row.id !== snapshot.id ||
      row.config !== snapshot.config ||
      row.isActive !== snapshot.isActive ||
      row.updatedAt.getTime() !== snapshot.updatedAt.getTime()
    ) {
      throw new HTTPException(409, {
        message: "Integration changed. Reload and try again.",
      });
    }
    // The locked row matches the already validated snapshot byte-for-byte.
    const oldConfig = previous;
    const config: GiteaConfig = {
      ...oldConfig,
      ...(body.commentTaskLinkOnGiteaIssue !== undefined
        ? { commentTaskLinkOnGiteaIssue: body.commentTaskLinkOnGiteaIssue }
        : {}),
      ...(body.issueSyncMode !== undefined
        ? { issueSyncMode: body.issueSyncMode }
        : {}),
    };
    await tx
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive: body.isActive ?? row.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(integrationTable.id, row.id));
    const targetMode = getGiteaIssueSyncMode(config);
    if (
      targetMode !== "sync" &&
      getGiteaIssueSyncMode(oldConfig) !== targetMode
    ) {
      await retireGiteaIssueEdits(row.id, tx, targetMode);
    }
  });
  const updated = await getGiteaIntegration(projectId, true);
  if (!updated)
    throw new HTTPException(500, { message: "Failed to load integration" });
  return updated;
}
