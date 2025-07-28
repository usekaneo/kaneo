import db from "../../database";

async function getLabelsByWorkspaceId(workspaceId: string) {
  const labels = await db.query.labelTable.findMany({
    where: (label, { eq }) => eq(label.workspaceId, workspaceId),
    orderBy: (label, { asc }) => [asc(label.name)],
  });

  return labels;
}

export default getLabelsByWorkspaceId;
