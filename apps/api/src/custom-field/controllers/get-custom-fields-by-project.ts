import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { customFieldDefinitionTable } from "../../database/schema";

async function getCustomFieldsByProject(projectId: string) {
  return db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId))
    .orderBy(asc(customFieldDefinitionTable.createdAt));
}

export default getCustomFieldsByProject;
