import { and, eq } from "drizzle-orm";
import db from "../../database";
import { labelTable } from "../../database/schema";

async function createLabel(name: string, color: string, workspaceId: string) {
  const existingLabel = await db
    .select()
    .from(labelTable)
    .where(
      and(eq(labelTable.name, name), eq(labelTable.workspaceId, workspaceId)),
    )
    .limit(1);

  if (existingLabel.length > 0) {
    throw new Error("Label with this name already exists in the workspace");
  }

  const [label] = await db
    .insert(labelTable)
    .values({ name, color, workspaceId })
    .returning();

  return label;
}

export default createLabel;
