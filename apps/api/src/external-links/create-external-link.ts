import { HTTPException } from "hono/http-exception";
import db from "../database";
import { externalLinksTable } from "../database/schema";

interface CreateExternalLinkData {
  taskId: string;
  type: string;
  title: string;
  url: string;
  externalId?: string;
  createdBy: string;
}

async function createExternalLink(data: CreateExternalLinkData) {
  try {
    const [newLink] = await db
      .insert(externalLinksTable)
      .values(data)
      .returning();

    return newLink;
  } catch (error) {
    console.error("Error creating external link:", error);
    throw new HTTPException(500, {
      message: "Failed to create external link",
    });
  }
}

export default createExternalLink;
export { createExternalLink };
