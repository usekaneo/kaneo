import { eq } from "drizzle-orm";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../../database/schema";

async function getCustomFieldValuesByTask(taskId: string) {
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
    .innerJoin(
      customFieldDefinitionTable,
      eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
    )
    .where(eq(customFieldValueTable.taskId, taskId));
}

export default getCustomFieldValuesByTask;