import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "../database";
import { timeEntryTable, userTable } from "../database/schema";
import { publishEvent } from "../events";
import { protectedProcedure, router } from "../lib/trpc";

export const timeEntryRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        description: z.string().optional(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date().optional(),
        duration: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const [createdTimeEntry] = await db
          .insert(timeEntryTable)
          .values({
            id: createId(),
            taskId: input.taskId,
            userId: ctx.session.user.id,
            description: input.description || "",
            startTime: input.startTime,
            endTime: input.endTime || null,
            duration: input.duration || 0,
          })
          .returning();

        if (!createdTimeEntry) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create time entry",
          });
        }

        await publishEvent("time-entry.created", {
          timeEntryId: createdTimeEntry.id,
          taskId: createdTimeEntry.taskId,
          userId: ctx.session.user.id,
          type: "create",
          content: "started time tracking",
        });

        return createdTimeEntry;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create time entry",
          cause: error,
        });
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const [timeEntry] = await db
          .select()
          .from(timeEntryTable)
          .where(eq(timeEntryTable.id, input.id));

        if (!timeEntry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Time entry not found",
          });
        }
        return timeEntry;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get time entry",
          cause: error,
        });
      }
    }),

  getByTaskId: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      try {
        const timeEntries = await db
          .select({
            id: timeEntryTable.id,
            taskId: timeEntryTable.taskId,
            userId: timeEntryTable.userId,
            userName: userTable.name,
            description: timeEntryTable.description,
            startTime: timeEntryTable.startTime,
            endTime: timeEntryTable.endTime,
            duration: timeEntryTable.duration,
            createdAt: timeEntryTable.createdAt,
          })
          .from(timeEntryTable)
          .leftJoin(userTable, eq(timeEntryTable.userId, userTable.id))
          .where(eq(timeEntryTable.taskId, input.taskId))
          .orderBy(timeEntryTable.startTime);

        return timeEntries;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get time entries for task",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        endTime: z.coerce.date(),
        duration: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const [existingTimeEntry] = await db
          .select()
          .from(timeEntryTable)
          .where(eq(timeEntryTable.id, input.id));

        if (!existingTimeEntry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Time entry not found",
          });
        }

        const [updatedTimeEntry] = await db
          .update(timeEntryTable)
          .set({
            endTime: input.endTime,
            duration: input.duration,
          })
          .where(eq(timeEntryTable.id, input.id))
          .returning();

        return updatedTimeEntry;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update time entry",
          cause: error,
        });
      }
    }),
});
