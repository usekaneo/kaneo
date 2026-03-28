import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskRelationTable } from "../../database/schema";

async function deleteTaskRelation(id: string) {
  const [relation] = await db
    .delete(taskRelationTable)
    .where(eq(taskRelationTable.id, id))
    .returning();

  if (!relation) {
    throw new HTTPException(404, {
      message: "Task relation not found",
    });
  }

  return relation;
}

export default deleteTaskRelation;
