import { eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customFieldDefinitionTable,
  projectTable,
} from "../../database/schema";
import { assertValidDefinition } from "../assert-valid-definition";
import { insertMissingValues } from "../fill-default-values";

async function createCustomField(
  projectId: string,
  name: string,
  type: string,
  required: boolean,
  defaultValue?: string,
  options?: string[],
) {
  if (!name.trim())
    throw new HTTPException(400, { message: "Name cannot be empty" });

  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  assertValidDefinition({ name, type, required, defaultValue, options });

  const storedDefaultValue =
    type === "date" ? defaultValue?.trim() : defaultValue;

  const [maxPositionResult] = await db
    .select({ maxPosition: max(customFieldDefinitionTable.position) })
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  const field = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(customFieldDefinitionTable)
      .values({
        projectId,
        name,
        type,
        required,
        defaultValue: storedDefaultValue ?? null,
        options: options ?? null,
        position: (maxPositionResult?.maxPosition ?? 0) + 1,
      })
      .returning();

    if (!created) {
      throw new HTTPException(500, {
        message: "Failed to create custom field",
      });
    }

    if (storedDefaultValue != null && storedDefaultValue.trim() !== "") {
      await insertMissingValues(tx, {
        projectId,
        fieldId: created.id,
        value: storedDefaultValue,
      });
    }

    return created;
  });

  return field;
}

export default createCustomField;
