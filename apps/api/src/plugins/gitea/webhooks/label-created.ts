import { sql } from "drizzle-orm";
import db from "../../../database";
import { labelTable } from "../../../database/schema";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

/** Gitea label events include the created label; older payloads may also set ref_type */
type LabelCreatePayload = {
  ref?: string;
  ref_type?: string;
  label?: {
    name: string;
    color: string;
    description?: string | null;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaLabelCreated(payload: LabelCreatePayload) {
  if ((payload.ref_type && payload.ref_type !== "label") || !payload.label) {
    return;
  }

  const { repository, label } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
  );

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    const workspaceId = integration.project.workspaceId;
    if (!workspaceId) {
      continue;
    }

    const color = label.color ? `#${label.color.replace(/^#/, "")}` : "#6B7280";

    await db
      .insert(labelTable)
      .values({
        name: label.name,
        color,
        workspaceId,
      })
      .onConflictDoNothing({
        target: [labelTable.workspaceId, labelTable.name],
        where: sql`${labelTable.taskId} is null`,
      });
  }
}
