import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "../database";
import { labelTable } from "../database/schema";
import { protectedProcedure, router } from "../lib/trpc";

export const labelRouter = router({
  // Create a new label
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        color: z.string(),
        taskId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const [label] = await db
        .insert(labelTable)
        .values({
          name: input.name,
          color: input.color,
          taskId: input.taskId,
        })
        .returning();

      return label;
    }),

  // Get a single label by ID
  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, input.id),
      });

      if (!label) {
        throw new Error("Label not found");
      }

      return label;
    }),

  // Get all labels for a task
  getByTaskId: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const labels = await db.query.labelTable.findMany({
        where: eq(labelTable.taskId, input.taskId),
      });

      return labels;
    }),

  // Update a label
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        color: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;

      const [updatedLabel] = await db
        .update(labelTable)
        .set(updateData)
        .where(eq(labelTable.id, id))
        .returning();

      return updatedLabel;
    }),

  // Delete a label
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.delete(labelTable).where(eq(labelTable.id, input.id));
    }),
});
