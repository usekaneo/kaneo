import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  customFieldDefinitionTable,
  customFieldValueTable,
  labelTable,
  projectTable,
  taskTable,
  workflowRuleTable,
} from "../../database/schema";

export const DEFAULT_PROJECT_COLUMNS = [
  { name: "To Do", slug: "to-do", position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 1, isFinal: false },
  { name: "In Review", slug: "in-review", position: 2, isFinal: false },
  { name: "Done", slug: "done", position: 3, isFinal: true },
] as const;

const COPY_BATCH_SIZE = 500;

type CreateProjectOptions = {
  sourceProjectId?: string;
  includeTasks?: boolean;
  asTemplate?: boolean;
};

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
  options: CreateProjectOptions = {},
) {
  if (options.asTemplate && !options.sourceProjectId) {
    throw new HTTPException(400, {
      message: "A source project is required to save a template",
    });
  }

  return db.transaction(async (tx) => {
    // Serialize ordering writes per workspace: without this, two concurrent
    // creates can read the same max(position) and land on the same slot, and a
    // create can interleave with a reorder's renumber. `reorderProjects` takes
    // the same lock with the same key.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
    );

    const source = options.sourceProjectId
      ? await tx.query.projectTable.findFirst({
          where: and(
            eq(projectTable.id, options.sourceProjectId),
            eq(projectTable.workspaceId, workspaceId),
          ),
        })
      : undefined;
    if (options.sourceProjectId && !source) {
      throw new HTTPException(404, { message: "Source project not found" });
    }

    const [{ maxPosition } = { maxPosition: null }] = await tx
      .select({ maxPosition: max(projectTable.position) })
      .from(projectTable)
      .where(eq(projectTable.workspaceId, workspaceId));

    const [createdProject] = await tx
      .insert(projectTable)
      .values({
        workspaceId,
        name,
        icon,
        slug,
        description: source?.description,
        isTemplate: options.asTemplate ?? false,
        position: maxPosition === null ? 0 : maxPosition + 1,
      })
      .returning();

    if (!createdProject) {
      throw new HTTPException(500, { message: "Failed to create project" });
    }

    if (!source) {
      await tx.insert(columnTable).values(
        DEFAULT_PROJECT_COLUMNS.map((column) => ({
          projectId: createdProject.id,
          ...column,
        })),
      );
      return createdProject;
    }

    const sourceColumns = await tx.query.columnTable.findMany({
      where: eq(columnTable.projectId, source.id),
      orderBy: [
        asc(columnTable.position),
        asc(columnTable.createdAt),
        asc(columnTable.id),
      ],
    });
    const columnIds = new Map<string, string>();
    for (const column of sourceColumns) {
      const [copy] = await tx
        .insert(columnTable)
        .values({
          projectId: createdProject.id,
          name: column.name,
          slug: column.slug,
          position: column.position,
          icon: column.icon,
          color: column.color,
          isFinal: column.isFinal,
        })
        .returning({ id: columnTable.id });
      if (!copy) throw new Error("Failed to copy project column");
      columnIds.set(column.id, copy.id);
    }

    const sourceFields = await tx.query.customFieldDefinitionTable.findMany({
      where: eq(customFieldDefinitionTable.projectId, source.id),
      orderBy: [
        asc(customFieldDefinitionTable.position),
        asc(customFieldDefinitionTable.id),
      ],
    });
    const fieldIds = new Map<string, string>();
    for (const field of sourceFields) {
      const [copy] = await tx
        .insert(customFieldDefinitionTable)
        .values({
          projectId: createdProject.id,
          name: field.name,
          type: field.type,
          required: field.required,
          defaultValue: field.defaultValue,
          options: field.options,
          position: field.position,
        })
        .returning({ id: customFieldDefinitionTable.id });
      if (!copy) throw new Error("Failed to copy custom field");
      fieldIds.set(field.id, copy.id);
    }

    const sourceRules = await tx.query.workflowRuleTable.findMany({
      where: eq(workflowRuleTable.projectId, source.id),
    });
    for (const rule of sourceRules) {
      const columnId = columnIds.get(rule.columnId);
      if (columnId) {
        await tx.insert(workflowRuleTable).values({
          projectId: createdProject.id,
          columnId,
          integrationType: rule.integrationType,
          eventType: rule.eventType,
        });
      }
    }

    if (!options.includeTasks) return createdProject;

    const sourceTasks = await tx.query.taskTable.findMany({
      where: eq(taskTable.projectId, source.id),
      orderBy: [asc(taskTable.number), asc(taskTable.id)],
    });
    if (sourceTasks.length === 0) return createdProject;

    const taskIds = new Map<string, string>();
    const copies = sourceTasks.map((task, index) => {
      const id = createId();
      taskIds.set(task.id, id);
      return {
        id,
        projectId: createdProject.id,
        number: index + 1,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        position: task.position,
        columnId: task.columnId ? (columnIds.get(task.columnId) ?? null) : null,
      };
    });
    for (let i = 0; i < copies.length; i += COPY_BATCH_SIZE) {
      await tx.insert(taskTable).values(copies.slice(i, i + COPY_BATCH_SIZE));
    }

    const sourceTaskIds = sourceTasks.map((task) => task.id);
    const labels = await tx.query.labelTable.findMany({
      where: and(
        inArray(labelTable.taskId, sourceTaskIds),
        eq(labelTable.workspaceId, workspaceId),
      ),
    });
    const copiedLabels = labels.flatMap((label) => {
      const taskId = label.taskId && taskIds.get(label.taskId);
      return taskId
        ? [{ taskId, workspaceId, name: label.name, color: label.color }]
        : [];
    });
    for (let i = 0; i < copiedLabels.length; i += COPY_BATCH_SIZE) {
      await tx
        .insert(labelTable)
        .values(copiedLabels.slice(i, i + COPY_BATCH_SIZE));
    }

    const values = await tx.query.customFieldValueTable.findMany({
      where: inArray(customFieldValueTable.taskId, sourceTaskIds),
    });
    const copiedValues = values.flatMap((value) => {
      const taskId = taskIds.get(value.taskId);
      const fieldId = fieldIds.get(value.fieldId);
      return taskId && fieldId ? [{ taskId, fieldId, value: value.value }] : [];
    });
    for (let i = 0; i < copiedValues.length; i += COPY_BATCH_SIZE) {
      await tx
        .insert(customFieldValueTable)
        .values(copiedValues.slice(i, i + COPY_BATCH_SIZE));
    }

    const [updatedProject] = await tx
      .update(projectTable)
      .set({ lastTaskNumber: sourceTasks.length })
      .where(eq(projectTable.id, createdProject.id))
      .returning();
    if (!updatedProject)
      throw new Error("Failed to update project task number");
    return updatedProject;
  });
}

export default createProject;
