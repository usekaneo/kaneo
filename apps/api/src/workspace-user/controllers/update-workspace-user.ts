import { eq } from "drizzle-orm";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function upsertWorkspaceUser(data: {
  email: string;
  status: string;
}) {
  const workspaceUser = await db.query.workspaceUserTable.findFirst({
    where: eq(workspaceUserTable.userEmail, data.email),
  });

  if (!workspaceUser) {
    return;
  }

  await db
    .update(workspaceUserTable)
    .set({ status: data.status })
    .where(eq(workspaceUserTable.id, workspaceUser.id));
}

export default upsertWorkspaceUser;
