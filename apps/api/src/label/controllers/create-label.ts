import db from "../../database";
import { labelTable } from "../../database/schema";
import { assertTaskWritable } from "../../utils/assert-task-writable";

async function createLabel(
  name: string,
  color: string,
  taskId: string | undefined,
  workspaceId: string,
) {
  if (taskId) {
    await assertTaskWritable(taskId);
  }

  const [label] = await db
    .insert(labelTable)
    .values({ name, color, taskId, workspaceId })
    .returning();

  return label;
}

export default createLabel;
