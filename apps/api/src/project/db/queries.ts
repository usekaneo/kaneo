import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { type Static, t } from 'elysia';
import { projectTable } from '../../database/schema';

export const getProjectSchema = createSelectSchema(projectTable, {
  workspaceId: t.String(),
  id: t.String(),
});

export const getProjectsSchema = createSelectSchema(projectTable, {
  workspaceId: t.String(),
});

export const createProjectSchema = createInsertSchema(projectTable, {
  name: t.String(),
  workspaceId: t.String(),
  description: t.String(),
});

export const updateProjectSchema = createUpdateSchema(projectTable, {
  id: t.String(),
  name: t.String(),
  description: t.String(),
  workspaceId: t.String(),
});

export const deleteProjectSchema = createInsertSchema(projectTable, {
  id: t.String(),
});

export type GetProjectPayload = Static<typeof getProjectSchema>;
export type GetProjectsPayload = Static<typeof getProjectsSchema>;
export type CreateProjectPayload = Static<typeof createProjectSchema>;
export type UpdateProjectPayload = Static<typeof updateProjectSchema>;
export type DeleteProjectPayload = Static<typeof deleteProjectSchema>;
