import { and, eq } from 'drizzle-orm';
import db from '../../database';
import { workspaceTable } from '../../database/schema';
import type { UpdateWorkspacePayload } from '../db/queries';

async function updateWorkspace({
  userEmail,
  workspaceId,
  body,
}: {
  userEmail: string;
  workspaceId: string;
  body: UpdateWorkspacePayload;
}) {
  const [existingWorkspace] = await db
    .select({
      id: workspaceTable.id,
      ownerEmail: workspaceTable.ownerEmail,
    })
    .from(workspaceTable)
    .where(
      and(
        eq(workspaceTable.id, workspaceId),
        eq(workspaceTable.ownerEmail, userEmail),
      ),
    )
    .limit(1);

  const isWorkspaceExisting = Boolean(existingWorkspace);

  if (!isWorkspaceExisting) {
    throw new Error("Workspace doesn't exist");
  }

  const updatedWorkspace = await db
    .update(workspaceTable)
    .set({
      ...body,
    })
    .where(eq(workspaceTable.id, workspaceId))
    .returning({
      id: workspaceTable.id,
      name: workspaceTable.name,
      ownerEmail: workspaceTable.ownerEmail,
      createdAt: workspaceTable.createdAt,
    });

  return updatedWorkspace.at(0);
}

export default updateWorkspace;
