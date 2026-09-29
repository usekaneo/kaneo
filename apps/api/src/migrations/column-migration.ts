import { and, eq, sql } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  dataMigrationTable,
  integrationTable,
  projectTable,
  taskTable,
  workflowRuleTable,
} from "../database/schema";

const DEFAULT_COLUMNS = [
  { name: "To Do", slug: "to-do", position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 1, isFinal: false },
  { name: "In Review", slug: "in-review", position: 2, isFinal: false },
  { name: "Done", slug: "done", position: 3, isFinal: true },
];

const EVENT_MAPPING: Record<string, string> = {
  onBranchPush: "branch_push",
  onPROpen: "pr_opened",
  onPRMerge: "pr_merged",
};

export async function migrateColumns() {
  await db.transaction(async (tx) => {
    // Serialize boots across instances, and record completion in the same commit.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('column-workflow-migration-v1'))`,
    );
    const [completed] = await tx
      .select()
      .from(dataMigrationTable)
      .where(eq(dataMigrationTable.id, "column-workflow-v1"))
      .limit(1);
    if (completed) return;
    console.log("🔄 Starting column migration...");

    const projects = await tx.select().from(projectTable);

    if (projects.length === 0) {
      console.log("No projects found, skipping column migration");
      await tx.insert(dataMigrationTable).values({ id: "column-workflow-v1" });
      return;
    }

    for (const project of projects) {
      const projectColumns = await tx
        .select({
          id: columnTable.id,
          slug: columnTable.slug,
        })
        .from(columnTable)
        .where(eq(columnTable.projectId, project.id));

      const columnMap = new Map<string, string>(
        projectColumns.map((column) => [column.slug, column.id]),
      );

      // Only seed missing default slugs for legacy projects that have no columns yet.
      // If the project already has columns, missing slugs are intentional (user removed them);
      // re-inserting on every startup would undo deletions after each API restart.
      if (projectColumns.length === 0) {
        for (const defaultColumn of DEFAULT_COLUMNS) {
          if (columnMap.has(defaultColumn.slug)) {
            continue;
          }

          const [inserted] = await tx
            .insert(columnTable)
            .values({
              projectId: project.id,
              name: defaultColumn.name,
              slug: defaultColumn.slug,
              position: defaultColumn.position,
              isFinal: defaultColumn.isFinal,
            })
            .returning({ id: columnTable.id, slug: columnTable.slug });

          if (inserted) {
            columnMap.set(inserted.slug, inserted.id);
          }
        }
      }

      for (const [slug, columnId] of columnMap) {
        await tx
          .update(taskTable)
          .set({ columnId })
          .where(
            sql`${taskTable.projectId} = ${project.id}
              AND ${taskTable.status} = ${slug}
              AND ${taskTable.columnId} IS DISTINCT FROM ${columnId}`,
          );
      }

      const integrations = await tx.query.integrationTable.findMany({
        where: eq(integrationTable.projectId, project.id),
      });

      for (const integration of integrations) {
        if (
          (integration.type !== "github" && integration.type !== "gitea") ||
          !integration.isActive
        ) {
          continue;
        }

        const forgeType = integration.type as "github" | "gitea";

        let config: { statusTransitions?: Record<string, string> };
        try {
          config = JSON.parse(integration.config);
          if (!config || typeof config !== "object") continue;
        } catch {
          console.error(
            `Skipping invalid legacy integration config ${integration.id}`,
          );
          continue;
        }
        {
          const transitions = config.statusTransitions || {};

          for (const [configKey, eventType] of Object.entries(EVENT_MAPPING)) {
            const targetSlug = transitions[configKey];
            if (!targetSlug) continue;

            const targetColumnId = columnMap.get(targetSlug);
            if (!targetColumnId) continue;

            await ensureMigrationWorkflowRule(
              tx,
              project.id,
              forgeType,
              eventType as string,
              targetColumnId,
            );
          }

          // Add default rules for issue events
          const todoColumnId = columnMap.get("to-do");
          const doneColumnId = columnMap.get("done");

          if (projectColumns.length === 0 && todoColumnId) {
            await ensureMigrationWorkflowRule(
              tx,
              project.id,
              forgeType,
              "issue_opened",
              todoColumnId,
            );
          }

          if (projectColumns.length === 0 && doneColumnId) {
            await ensureMigrationWorkflowRule(
              tx,
              project.id,
              forgeType,
              "issue_closed",
              doneColumnId,
            );
          }
        }
      }
    }

    console.log(
      `✅ Column migration complete! Migrated ${projects.length} projects`,
    );
    await tx.insert(dataMigrationTable).values({ id: "column-workflow-v1" });
  });
}

async function ensureMigrationWorkflowRule(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string,
  integrationType: "github" | "gitea",
  eventType: string,
  columnId: string,
) {
  const existing = await tx.query.workflowRuleTable.findFirst({
    where: and(
      eq(workflowRuleTable.projectId, projectId),
      eq(workflowRuleTable.integrationType, integrationType),
      eq(workflowRuleTable.eventType, eventType),
    ),
  });

  if (existing) {
    return;
  }

  await tx.insert(workflowRuleTable).values({
    projectId,
    integrationType,
    eventType,
    columnId,
  });
}
