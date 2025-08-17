import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { externalLinksTable } from "../database/schema";

interface UpdateExternalLinkData {
  title: string;
  url: string;
  externalId?: string;
}

async function updateExternalLink(
  linkId: string,
  data: UpdateExternalLinkData,
) {
  try {
    const [updatedLink] = await db
      .update(externalLinksTable)
      .set(data)
      .where(eq(externalLinksTable.id, linkId))
      .returning();

    if (!updatedLink) {
      throw new HTTPException(404, {
        message: "External link not found",
      });
    }

    return updatedLink;
  } catch (error) {
    console.error("Error updating external link:", error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, {
      message: "Failed to update external link",
    });
  }
}

export default updateExternalLink;
export { updateExternalLink };
