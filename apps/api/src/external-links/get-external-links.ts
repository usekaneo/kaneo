import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { externalLinksTable } from "../database/schema";

async function getExternalLinks(taskId: string) {
  try {
    const externalLinks = await db
      .select()
      .from(externalLinksTable)
      .where(eq(externalLinksTable.taskId, taskId))
      .orderBy(externalLinksTable.createdAt);

    return externalLinks;
  } catch (error) {
    console.error("Error fetching external links:", error);
    throw new HTTPException(500, {
      message: "Failed to fetch external links",
    });
  }
}

export default getExternalLinks;
export { getExternalLinks };
