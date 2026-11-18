import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";

// RFC 0001 WP3: delete by integration id (primary key). Cascades remove the
// binding's external_link rows automatically; tasks created from its issues
// remain in the project. Deleting one binding leaves the others fully
// functional, including their webhook routes.
async function deleteGiteaIntegration(integrationId: string) {
  const existingIntegration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (!existingIntegration) {
    throw new HTTPException(404, { message: "Gitea integration not found" });
  }

  await db
    .delete(integrationTable)
    .where(eq(integrationTable.id, integrationId));

  return { success: true, message: "Gitea integration deleted" };
}

export default deleteGiteaIntegration;
