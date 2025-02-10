import { createInsertSchema } from 'drizzle-typebox';
import { type Static, t } from 'elysia';
import { workspaceTable } from '../../database/schema';

export const createWorkspaceSchema = createInsertSchema(workspaceTable, {
  name: t.String(),
});

export const updateWorkspaceSchema = t.Object({
  name: t.Optional(t.String()),
  description: t.Optional(t.String()),
});

export const deleteWorkspaceSchema = t.Object({
  userEmail: t.String(),
  workspaceId: t.String(),
});

export type CreateWorkspacePayload = Static<typeof createWorkspaceSchema>;
export type UpdateWorkspacePayload = Static<typeof updateWorkspaceSchema>;
export type DeleteWorkspacePayload = Static<typeof deleteWorkspaceSchema>;
