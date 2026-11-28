import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";

export default async function deleteTangledIntegration(projectId: string) {
  const [deleted] = await db
    .delete(integrationTable)
    .where(
      and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "tangled"),
      ),
    )
    .returning({ id: integrationTable.id });
  if (!deleted)
    throw new HTTPException(404, { message: "Tangled integration not found" });
  return { success: true as const };
}
