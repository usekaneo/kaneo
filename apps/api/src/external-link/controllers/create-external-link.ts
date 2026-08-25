import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { externalLinkTable } from "../../database/schema";

async function createExternalLink({
  taskId,
  url,
  title,
}: {
  taskId: string;
  url: string;
  title?: string;
}) {
  const [link] = await db
    .insert(externalLinkTable)
    .values({
      taskId,
      integrationId: null,
      resourceType: "url",
      externalId: url,
      url,
      title: title ?? null,
    })
    .returning();

  if (!link) {
    throw new HTTPException(500, {
      message: "Failed to create external link",
    });
  }

  return link;
}

export default createExternalLink;
