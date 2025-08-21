import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import db from "../database";
import { activityTable } from "../database/schema";
import { protectedProcedure, router } from "../lib/trpc";

export const activityRouter = router({
  // Create a general activity
  create: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        type: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const activity = await db.insert(activityTable).values({
        taskId: input.taskId,
        type: input.type,
        userId: ctx.session.user.id,
        content: input.content,
      });
      return activity;
    }),

  // Create a comment (specific type of activity)
  createComment: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const activity = await db.insert(activityTable).values({
        taskId: input.taskId,
        type: "comment",
        userId: ctx.session.user.id,
        content: input.content,
      });
      return activity;
    }),

  // Get activities for a task
  getByTaskId: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const activities = await db.query.activityTable.findMany({
        where: eq(activityTable.taskId, input.taskId),
        orderBy: [desc(activityTable.createdAt), desc(activityTable.id)],
      });
      return activities;
    }),

  // Update a comment
  updateComment: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await db
        .update(activityTable)
        .set({ content: input.content })
        .where(
          and(
            eq(activityTable.id, input.id),
            eq(activityTable.userId, ctx.session.user.id),
          ),
        );
    }),

  // Delete a comment
  deleteComment: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(activityTable)
        .where(
          and(
            eq(activityTable.id, input.id),
            eq(activityTable.userId, ctx.session.user.id),
          ),
        );
    }),
});
