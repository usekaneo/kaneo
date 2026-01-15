import { tasksByStatus, updateTaskStatus } from './task';

export const customResolvers = {
  Query: { tasksByStatus },
  Mutation: { updateTaskStatus },
};