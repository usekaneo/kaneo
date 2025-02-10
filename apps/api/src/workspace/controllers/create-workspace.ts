import db from '../../database';
import { workspaceTable } from '../../database/schema';
import type { CreateWorkspacePayload } from '../db/queries';

async function createWorkspace(body: CreateWorkspacePayload) {
  const [workspace] = await db.insert(workspaceTable).values(body).returning();
  return workspace;
}

export default createWorkspace;
