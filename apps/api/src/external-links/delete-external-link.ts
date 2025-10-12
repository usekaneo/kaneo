import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { externalLinksTable } from "../database/schema";

async function deleteExternalLink(linkId: string) {
  try {
    const [deletedLink] = await db
      .delete(externalLinksTable)
      .where(eq(externalLinksTable.id, linkId))
      .returning();

    if (!deletedLink) {
      throw new HTTPException(404, {
        message: "External link not found",
      });
    }

    return deletedLink;
  } catch (error) {
    console.error("Error deleting external link:", error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, {
      message: "Failed to delete external link",
    });
  }
}

export default deleteExternalLink;
export { deleteExternalLink };
