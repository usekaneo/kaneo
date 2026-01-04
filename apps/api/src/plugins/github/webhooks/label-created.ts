import { eq } from "drizzle-orm";
import db from "../../../database";
import { labelTable, projectTable } from "../../../database/schema";
import { findIntegrationByRepo } from "../services/task-service";

type LabelCreatedPayload = {
  action: string;
  label: {
    name: string;
    color: string;
    description?: string | null;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
};

export async function handleLabelCreated(payload: LabelCreatedPayload) {
  const { repository, label } = payload;

  const integration = await findIntegrationByRepo(
    repository.owner.login,
    repository.name,
  );

  if (!integration?.project) {
    return;
  }

  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, integration.project.id),
  });

  if (!project?.workspaceId) {
    return;
  }

  const labelExists = await db.query.labelTable.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.workspaceId, project.workspaceId),
        eq(table.name, label.name),
      ),
  });

  if (labelExists) {
    return;
  }

  const color = label.color ? `#${label.color}` : "#6B7280";

  await db.insert(labelTable).values({
    name: label.name,
    color,
    workspaceId: project.workspaceId,
  });
}
