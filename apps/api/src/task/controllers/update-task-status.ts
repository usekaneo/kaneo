import { eq } from 'drizzle-orm';
import db from '../../database';
import { taskTable } from '../../database/schema';

async function updateTaskStatus({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  await db
    .update(taskTable)
    .set({ status: status })
    .where(eq(taskTable.id, id));
}

export default updateTaskStatus;
