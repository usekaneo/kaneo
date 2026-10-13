import { and, eq, sql } from "drizzle-orm";
import db from "../../../database";
import {
  externalLinkTable,
  integrationTable,
  projectTable,
  taskTable,
} from "../../../database/schema";

export type IntegrationDatabase =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];
type IntegrationScope = {
  id: string;
  projectId: string;
  project?: { workspaceId: string };
};

// Key-share protects the project/workspace key while allowing task-number
// allocation. Task locks protect their project until related writes commit.
export async function withIntegrationTask<T>(
  taskId: string | null,
  integration: IntegrationScope,
  apply: (
    database: IntegrationDatabase,
    afterCommit: (effect: () => Promise<void>) => void,
  ) => Promise<T>,
  expectedBinding?: {
    config?: string;
    type?: string;
    validate?: (binding: { config: string; type: string }) => boolean;
  },
): Promise<T | undefined> {
  const effects: Array<() => Promise<void>> = [];
  const result = await db.transaction(async (tx) => {
    if (taskId === null) {
      const [binding] = await tx
        .select({ id: integrationTable.id })
        .from(integrationTable)
        .where(
          and(
            eq(integrationTable.id, integration.id),
            eq(integrationTable.isActive, true),
          ),
        )
        .for("no key update");
      if (!binding) return undefined;
    }
    const [project] = await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .innerJoin(
        integrationTable,
        eq(integrationTable.projectId, projectTable.id),
      )
      .where(
        and(
          eq(integrationTable.id, integration.id),
          eq(projectTable.id, integration.projectId),
          integration.project
            ? eq(projectTable.workspaceId, integration.project.workspaceId)
            : undefined,
        ),
      )
      .for("key share", { of: [projectTable, integrationTable] });
    if (!project) return undefined;
    if (expectedBinding) {
      const [binding] = await tx
        .select({
          config: integrationTable.config,
          type: integrationTable.type,
        })
        .from(integrationTable)
        .where(
          and(
            eq(integrationTable.id, integration.id),
            expectedBinding.config === undefined
              ? undefined
              : eq(integrationTable.config, expectedBinding.config),
            expectedBinding.type === undefined
              ? undefined
              : eq(integrationTable.type, expectedBinding.type),
            eq(integrationTable.isActive, true),
          ),
        )
        .for("share");
      if (
        !binding ||
        (expectedBinding.validate && !expectedBinding.validate(binding))
      )
        return undefined;
    }
    if (taskId !== null) {
      const [task] = await tx
        .select({ id: taskTable.id })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.id, taskId),
            eq(taskTable.projectId, integration.projectId),
          ),
        )
        .for("no key update");
      if (!task) return undefined;
    }
    return apply(tx, (effect) => effects.push(effect));
  });
  for (const effect of effects) await effect();
  return result;
}

export function linkedTaskScope(taskId: string, projectId: string) {
  return and(eq(taskTable.id, taskId), eq(taskTable.projectId, projectId));
}

export function externalLinkScope() {
  return sql`exists (select 1 from ${taskTable} scoped_task join ${integrationTable} scoped_integration on scoped_integration.project_id = scoped_task.project_id where scoped_task.id = ${externalLinkTable.taskId} and scoped_integration.id = ${externalLinkTable.integrationId})`;
}

export async function integrationTaskRevision(
  taskId: string,
  projectId: string,
  database: IntegrationDatabase = db,
) {
  const [task] = await database
    .select({ revision: sql<string>`${taskTable}.xmin::text` })
    .from(taskTable)
    .where(linkedTaskScope(taskId, projectId));
  return task?.revision;
}
