import { eq, sql } from "drizzle-orm";
import db from "../../../database";
import { labelTable, projectTable } from "../../../database/schema";
import { findAllIntegrationsByRepo } from "../services/task-service";

type LabelCreatedPayload = {
  action: string;
  label: {
    name: string;
    color: string;
    description?: string | null;
  };
  installation?: { id: number };
  repository: {
    id: number;
    owner: { login: string };
    name: string;
  };
};

export async function handleLabelCreated(payload: LabelCreatedPayload) {
  const { label } = payload;

  const integrations = await findAllIntegrationsByRepo(payload);

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, integration.project.id),
    });

    if (!project?.workspaceId) {
      continue;
    }

    const labelExists = await db.query.labelTable.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.workspaceId, project.workspaceId),
          eq(table.name, label.name),
        ),
    });

    if (labelExists) {
      continue;
    }

    const color = label.color ? `#${label.color}` : "#6B7280";

    await db
      .insert(labelTable)
      .values({
        name: label.name,
        color,
        workspaceId: project.workspaceId,
      })
      .onConflictDoNothing({
        target: [labelTable.workspaceId, labelTable.name],
        where: sql`${labelTable.taskId} is null`,
      });
  }
}
