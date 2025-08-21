import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../../lib/trpc";
import createTask from "./controllers/create-task";
import deleteTask from "./controllers/delete-task";
import exportTasks from "./controllers/export-tasks";
import getNextTaskNumber from "./controllers/get-next-task-number";
import getTask from "./controllers/get-task";
import getTasks from "./controllers/get-tasks";
import importTasks from "./controllers/import-tasks";
import updateTask from "./controllers/update-task";
import updateTaskStatus from "./controllers/update-task-status";

export const taskRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string().optional(),
        title: z.string(),
        status: z.string(),
        dueDate: z.date().optional(),
        description: z.string().optional(),
        priority: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await createTask(input);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create task",
          cause: error,
        });
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await getTask(input.id);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
          cause: error,
        });
      }
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        // TODO: Filters
        // status: z.string().optional(),
        // userId: z.string().optional(),
        // limit: z.number().min(1).max(100).default(50),
        // offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await getTasks(input.projectId);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch tasks",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        dueDate: z.coerce.date(),
        projectId: z.string(),
        description: z.string(),
        priority: z.string(),
        position: z.number(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await updateTask(
          input.id,
          input.title,
          input.status,
          input.dueDate,
          input.projectId,
          input.description,
          input.priority,
          input.position,
          input.userId,
        );
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update task",
          cause: error,
        });
      }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await updateTaskStatus(input);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update task status",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await deleteTask(input.id);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete task",
          cause: error,
        });
      }
    }),

  getNextNumber: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await getNextTaskNumber(input.projectId);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get next task number",
          cause: error,
        });
      }
    }),

  export: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await exportTasks(input.projectId);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export tasks",
          cause: error,
        });
      }
    }),

  import: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        tasks: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            status: z.string(),
            priority: z.string().optional(),
            dueDate: z.string().optional(),
            userId: z.string().nullable().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await importTasks(input.projectId, input.tasks);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to import tasks",
          cause: error,
        });
      }
    }),
});
