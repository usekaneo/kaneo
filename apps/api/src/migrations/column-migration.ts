import { and, eq, sql } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
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
  console.log("🔄 Starting column migration...");

  const projects = await db.select().from(projectTable);

  if (projects.length === 0) {
    console.log("No projects found, skipping column migration");
    return;
  }

  for (const project of projects) {
    const projectColumns = await db
      .select({
        id: columnTable.id,
        slug: columnTable.slug,
      })
      .from(columnTable)
      .where(eq(columnTable.projectId, project.id));

    const columnMap = new Map<string, string>(
      projectColumns.map((column) => [column.slug, column.id]),
    );

    for (const defaultColumn of DEFAULT_COLUMNS) {
      if (columnMap.has(defaultColumn.slug)) {
        continue;
      }

      const [inserted] = await db
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

    for (const [slug, columnId] of columnMap) {
      await db
        .update(taskTable)
        .set({ columnId })
        .where(
          sql`${taskTable.projectId} = ${project.id}
              AND ${taskTable.status} = ${slug}
              AND ${taskTable.columnId} IS DISTINCT FROM ${columnId}`,
        );
    }

    const integrations = await db.query.integrationTable.findMany({
      where: eq(integrationTable.projectId, project.id),
    });

    for (const integration of integrations) {
      if (integration.type !== "github" || !integration.isActive) continue;

      try {
        const config = JSON.parse(integration.config);
        const transitions = config.statusTransitions || {};

        for (const [configKey, eventType] of Object.entries(EVENT_MAPPING)) {
          const targetSlug = transitions[configKey];
          if (!targetSlug) continue;

          const targetColumnId = columnMap.get(targetSlug);
          if (!targetColumnId) continue;

          await upsertMigrationWorkflowRule(
            project.id,
            eventType as string,
            targetColumnId,
          );
        }

        // Add default rules for issue events
        const todoColumnId = columnMap.get("to-do");
        const doneColumnId = columnMap.get("done");

        if (todoColumnId) {
          await upsertMigrationWorkflowRule(
            project.id,
            "issue_opened",
            todoColumnId,
          );
        }

        if (doneColumnId) {
          await upsertMigrationWorkflowRule(
            project.id,
            "issue_closed",
            doneColumnId,
          );
        }
      } catch {
        console.error(
          `Failed to migrate workflow rules for integration ${integration.id}`,
        );
      }
    }
  }

  console.log(
    `✅ Column migration complete! Migrated ${projects.length} projects`,
  );
}

async function upsertMigrationWorkflowRule(
  projectId: string,
  eventType: string,
  columnId: string,
) {
  const existing = await db.query.workflowRuleTable.findFirst({
    where: and(
      eq(workflowRuleTable.projectId, projectId),
      eq(workflowRuleTable.integrationType, "github"),
      eq(workflowRuleTable.eventType, eventType),
    ),
  });

  if (!existing) {
    await db.insert(workflowRuleTable).values({
      projectId,
      integrationType: "github",
      eventType,
      columnId,
    });
    return;
  }

  if (existing.columnId !== columnId) {
    await db
      .update(workflowRuleTable)
      .set({ columnId })
      .where(eq(workflowRuleTable.id, existing.id));
  }
}
