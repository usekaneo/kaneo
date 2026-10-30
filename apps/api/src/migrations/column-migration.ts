import { and, eq, inArray, sql } from "drizzle-orm";
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

const COMPLETION_ID = "column-workflow-v1";
const PENDING_PREFIX = "column-workflow-pending:";

export async function migrateColumns() {
  await db.transaction(async (coordinator) => {
    // Only coordination lives in this transaction; project writes commit
    // separately so startup does not retain every migrated task's row lock.
    await coordinator.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('column-workflow-migration-v1'))`,
    );
    const markers = await coordinator
      .select({ id: dataMigrationTable.id })
      .from(dataMigrationTable);
    if (markers.some((marker) => marker.id === COMPLETION_ID)) return;
    const pending = new Set(
      markers
        .filter((marker) => marker.id.startsWith(PENDING_PREFIX))
        .map((marker) => marker.id.slice(PENDING_PREFIX.length)),
    );
    const projects = await coordinator
      .select({ id: projectTable.id })
      .from(projectTable);
    let incomplete = false;
    for (const project of projects) {
      const complete = await migrateProject(project.id, pending);
      if (!complete) incomplete = true;
    }
    if (!incomplete)
      await coordinator
        .insert(dataMigrationTable)
        .values({ id: COMPLETION_ID });
  });
}

async function migrateProject(projectId: string, pending: Set<string>) {
  return db.transaction(async (tx) => {
    const projectColumns = await tx
      .select({ id: columnTable.id, slug: columnTable.slug })
      .from(columnTable)
      .where(eq(columnTable.projectId, projectId));
    const legacy = projectColumns.length === 0;
    // Existing columns are the durable evidence of the old migration. Without
    // this inference the first upgrade would restore rules users already deleted.
    const integrations = await tx.query.integrationTable.findMany({
      where: and(
        eq(integrationTable.projectId, projectId),
        inArray(integrationTable.type, ["github", "gitea"]),
      ),
    });
    if (!legacy && integrations.length === 0) return true;
    const columnMap = new Map(
      projectColumns.map((column) => [column.slug, column.id]),
    );
    if (legacy) {
      for (const column of DEFAULT_COLUMNS) {
        const [created] = await tx
          .insert(columnTable)
          .values({ ...column, projectId })
          .returning({ id: columnTable.id });
        if (!created) throw new Error("Migration column was not created");
        columnMap.set(column.slug, created.id);
      }
      for (const [slug, columnId] of columnMap) {
        await tx.update(taskTable).set({ columnId })
          .where(sql`${taskTable.projectId} = ${projectId}
          AND ${taskTable.status} = ${slug} AND ${taskTable.columnId} IS DISTINCT FROM ${columnId}`);
      }
    }
    let complete = true;
    for (const integration of integrations) {
      let config: { statusTransitions?: Record<string, string> };
      try {
        config = JSON.parse(integration.config);
        if (!config || typeof config !== "object" || Array.isArray(config))
          throw new Error("Invalid legacy configuration");
        const transitions = config.statusTransitions;
        if (
          transitions !== undefined &&
          (!transitions ||
            typeof transitions !== "object" ||
            Array.isArray(transitions) ||
            Object.keys(EVENT_MAPPING)
              .map((key) => transitions[key])
              .filter((value) => value !== undefined)
              .some((value) => typeof value !== "string"))
        )
          throw new Error("Invalid legacy status transitions");
      } catch {
        console.error(
          `Skipping invalid legacy integration config ${integration.id}`,
        );
        await tx
          .insert(dataMigrationTable)
          .values({ id: PENDING_PREFIX + integration.id })
          .onConflictDoNothing();
        complete = false;
        continue;
      }
      if (!legacy && !pending.has(integration.id)) continue;
      const forgeType = integration.type as "github" | "gitea";
      for (const [key, eventType] of Object.entries(EVENT_MAPPING)) {
        const slug = config.statusTransitions?.[key];
        const columnId = slug ? columnMap.get(slug) : undefined;
        if (columnId)
          await ensureMigrationWorkflowRule(
            tx,
            projectId,
            forgeType,
            eventType,
            columnId,
          );
      }
      for (const [slug, eventType] of [
        ["to-do", "issue_opened"],
        ["done", "issue_closed"],
      ] as const) {
        const columnId = columnMap.get(slug);
        if (columnId)
          await ensureMigrationWorkflowRule(
            tx,
            projectId,
            forgeType,
            eventType,
            columnId,
          );
      }
      if (pending.has(integration.id))
        await tx
          .delete(dataMigrationTable)
          .where(eq(dataMigrationTable.id, PENDING_PREFIX + integration.id));
    }
    return complete;
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
