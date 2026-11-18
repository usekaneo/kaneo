import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";

// RFC 0001 WP2: delete by integration id (primary key). Cascades remove the
// binding's external_link and github_import rows automatically; tasks
// created from its issues remain in the project (stated verbatim in the
// disconnect confirmation copy of WP7).
async function deleteGithubIntegration(integrationId: string) {
  const existingIntegration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (!existingIntegration) {
    throw new HTTPException(404, { message: "GitHub integration not found" });
  }

  await db
    .delete(integrationTable)
    .where(eq(integrationTable.id, integrationId));

  return { success: true, message: "GitHub integration deleted" };
}

export default deleteGithubIntegration;
