import { and, asc, eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function getProjectTemplates(workspaceId: string) {
  return db.query.projectTable.findMany({
    where: and(
      eq(projectTable.workspaceId, workspaceId),
      eq(projectTable.isTemplate, true),
    ),
    orderBy: [
      asc(projectTable.position),
      asc(projectTable.createdAt),
      asc(projectTable.id),
    ],
  });
}

export default getProjectTemplates;
