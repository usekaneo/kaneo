import db from "../../database";
import { labelTable } from "../../database/schema";

async function createLabel(
  name: string,
  color: string,
  taskId: string | undefined,
  workspaceId: string,
) {
  const [label] = await db
    .insert(labelTable)
    .values({ name, color, taskId, workspaceId })
    .returning();

  return label;
}

export default createLabel;
