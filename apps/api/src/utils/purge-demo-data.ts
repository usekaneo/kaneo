import { projectTable } from "../database/schema";
import { taskTable } from "../database/schema";
import { userTable } from "../database/schema";
import { workspaceTable } from "../database/schema";
import { workspaceUserTable } from "../database/schema";

import db from "../database";

async function purgeData() {
  await db.delete(userTable);
  await db.delete(workspaceTable);
  await db.delete(workspaceUserTable);
  await db.delete(projectTable);
  await db.delete(taskTable);
}

export default purgeData;
