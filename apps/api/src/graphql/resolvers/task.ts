import { GraphQLFieldResolver } from 'graphql';
import db from '../../database';
import { taskTable } from '../../database/schema';
import { eq, and } from 'drizzle-orm';

export const tasksByStatus: GraphQLFieldResolver<any, any> = async (
  _parent, { status, projectId }, _context
) => {
  return await db
    .select()
    .from(taskTable)
    .where(
      and(
        eq(taskTable.status, status),
        projectId ? eq(taskTable.projectId, projectId) : undefined
      )
    );
};

export const updateTaskStatus: GraphQLFieldResolver<any, any> = async (
  _parent, { id, status }, _context
) => {
  const [updated] = await db
    .update(taskTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(taskTable.id, id))
    .returning();
  return updated;
};