import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  externalLinkTable,
  integrationTable,
  taskTable,
} from "../../database/schema";
import { defaultGitHubConfig } from "./config";

// RFC 0001 (cleanup): the legacy github_integration table is no longer
// part of the Drizzle schema; this startup migration reads and drops
// it through raw SQL.
type LegacyGitHubIntegrationRow = {
  id: string;
  projectId: string;
  repositoryOwner: string;
  repositoryName: string;
  installationId: number | null;
  isActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public'
				AND table_name = ${tableName}
			);
		`);
    return (result.rows[0] as { exists: boolean })?.exists === true;
  } catch {
    return false;
  }
}

export async function migrateGitHubIntegration() {
  const oldTableExists = await tableExists("github_integration");

  if (!oldTableExists) {
    console.log("No old github_integration table found, skipping migration");
    return;
  }

  console.log("Starting GitHub integration migration...");

  try {
    const legacyResult = await db.execute<LegacyGitHubIntegrationRow>(sql`
      SELECT
        id,
        project_id AS "projectId",
        repository_owner AS "repositoryOwner",
        repository_name AS "repositoryName",
        installation_id AS "installationId",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM github_integration
      ORDER BY created_at ASC
    `);
    const oldIntegrations = legacyResult.rows;

    if (oldIntegrations.length === 0) {
      console.log("No old integrations to migrate");
      await dropOldTable();
      return;
    }

    let migratedCount = 0;

    for (const old of oldIntegrations) {
      const existingIntegration = await db.query.integrationTable.findFirst({
        where: and(
          eq(integrationTable.projectId, old.projectId),
          eq(integrationTable.type, "github"),
        ),
      });

      if (existingIntegration) {
        continue;
      }

      await db.insert(integrationTable).values({
        projectId: old.projectId,
        type: "github",
        config: JSON.stringify({
          repositoryOwner: old.repositoryOwner,
          repositoryName: old.repositoryName,
          installationId: old.installationId,
          ...defaultGitHubConfig,
        }),
        repositoryKey: `github:${old.repositoryOwner.toLowerCase()}/${old.repositoryName.toLowerCase()}`,
        repositoryOwner: old.repositoryOwner,
        repositoryName: old.repositoryName,
        isActive: old.isActive ?? true,
        createdAt: old.createdAt,
        updatedAt: old.updatedAt,
      });

      migratedCount++;
    }

    console.log(`Migrated ${migratedCount} integrations`);

    await migrateTaskLinks();

    await dropOldTable();

    console.log("GitHub integration migration complete!");
  } catch (error) {
    console.error("Failed to migrate GitHub integration:", error);
    throw error;
  }
}

async function migrateTaskLinks() {
  console.log("Migrating task links from descriptions...");

  const tasks = await db.query.taskTable.findMany();

  let linksCreated = 0;
  let descriptionsUpdated = 0;

  for (const task of tasks) {
    if (!task.description) continue;

    const linkMatch = task.description.match(
      /(Linked to|Created from) GitHub issue: (https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+))/,
    );

    if (!linkMatch) continue;

    const linkType = linkMatch[1];
    const url = linkMatch[2];
    const owner = linkMatch[3];
    const repo = linkMatch[4];
    const issueNumber = linkMatch[5];

    if (!url || !owner || !repo || !issueNumber) continue;

    const integration = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, task.projectId),
        eq(integrationTable.type, "github"),
      ),
    });

    if (!integration) continue;

    const config = JSON.parse(integration.config);
    if (config.repositoryOwner !== owner || config.repositoryName !== repo) {
      continue;
    }

    const existingLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.taskId, task.id),
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "issue"),
      ),
    });

    if (!existingLink) {
      await db.insert(externalLinkTable).values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: issueNumber,
        url: url,
        title: null,
        metadata: JSON.stringify({
          migrated: true,
          createdFrom: linkType === "Created from" ? "github" : "kaneo",
        }),
      });
      linksCreated++;
    }

    const cleanedDescription = task.description
      .replace(/\n\n---\n\n\*.*GitHub issue:.*\*/g, "")
      .replace(/\n---\n<sub>Task:.*<\/sub>/g, "")
      .trim();

    if (cleanedDescription !== task.description) {
      await db
        .update(taskTable)
        .set({ description: cleanedDescription || null })
        .where(eq(taskTable.id, task.id));
      descriptionsUpdated++;
    }
  }

  console.log(`Created ${linksCreated} external links`);
  console.log(`Cleaned ${descriptionsUpdated} task descriptions`);
}

async function dropOldTable() {
  console.log("Dropping old github_integration table...");
  await db.execute(sql`DROP TABLE IF EXISTS github_integration CASCADE`);
  console.log("Dropped github_integration table");
}
