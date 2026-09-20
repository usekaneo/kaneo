import { eq } from "drizzle-orm";
import { Effect } from "effect";
import {
  customFieldDefinitionTable,
  projectTable,
} from "../../database/schema";
import { Database } from "../../effect/database";
import { NotFound } from "../../effect/errors";
import {
  CustomFieldOrProjectNotFound,
  ProjectWithoutWorkspace,
} from "../errors";

const deleteCustomField = Effect.fn("customField.deleteCustomField")(function* (
  id: string,
) {
  const database = yield* Database;

  const [field] = yield* database.query((db) =>
    db
      .select({
        projectId: customFieldDefinitionTable.projectId,
        workspaceId: projectTable.workspaceId,
      })
      .from(customFieldDefinitionTable)
      .innerJoin(
        projectTable,
        eq(projectTable.id, customFieldDefinitionTable.projectId),
      )
      .where(eq(customFieldDefinitionTable.id, id))
      .limit(1),
  );

  if (!field) {
    return yield* new CustomFieldOrProjectNotFound({ id });
  }

  if (!field.workspaceId) {
    return yield* new ProjectWithoutWorkspace({ projectId: field.projectId });
  }

  const [deleted] = yield* database.query((db) =>
    db
      .delete(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.id, id))
      .returning(),
  );

  if (!deleted) {
    return yield* new NotFound({ entity: "Custom field", id });
  }

  return {
    ...deleted,
    workspaceId: field.workspaceId,
  };
});

export default deleteCustomField;
