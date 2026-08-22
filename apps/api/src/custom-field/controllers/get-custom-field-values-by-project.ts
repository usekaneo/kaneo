import { eq } from "drizzle-orm";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";

async function getCustomFieldValuesByProject(projectId: string) {
  return db
    .select({
      id: customFieldValueTable.id,
      taskId: customFieldValueTable.taskId,
      fieldId: customFieldValueTable.fieldId,
      value: customFieldValueTable.value,
      fieldName: customFieldDefinitionTable.name,
      fieldType: customFieldDefinitionTable.type,
      fieldOptions: customFieldDefinitionTable.options,
    })
    .from(customFieldValueTable)
    .innerJoin(taskTable, eq(customFieldValueTable.taskId, taskTable.id))
    .innerJoin(
      customFieldDefinitionTable,
      eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
    )
    .where(eq(taskTable.projectId, projectId));
}

export default getCustomFieldValuesByProject;
