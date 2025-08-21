import { and, eq } from "drizzle-orm";
import { z } from "zod";
import db from "../database";
import { projectTable } from "../database/schema";
import {
  protectedProcedure,
  publicProcedure,
  router,
  workspaceProcedure,
} from "../lib/trpc";
import getTasks from "./task/controllers/get-tasks";

export const projectRouter = router({
  // Create a new project
  create: workspaceProcedure
    .input(
      z.object({
        name: z.string(),
        icon: z.string(),
        slug: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [createdProject] = await db
        .insert(projectTable)
        .values({
          workspaceId: ctx.activeWorkspaceId,
          name: input.name,
          icon: input.icon,
          slug: input.slug,
          description: input.description,
        })
        .returning();

      return createdProject;
    }),

  // Get a single project by ID
  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const project = await getTasks(input.id);

      if (!project) {
        throw new Error("Project not found");
      }

      // Add createdAt and tasks array for backward compatibility
      const projectWithTasks = await db.query.projectTable.findFirst({
        where: eq(projectTable.id, input.id),
        with: {
          tasks: true,
        },
      });

      return {
        ...project,
        createdAt: projectWithTasks?.createdAt,
        tasks: projectWithTasks?.tasks || [],
      };
    }),

  // Get all projects for a workspace
  list: workspaceProcedure.query(async ({ ctx }) => {
    const projects = await db.query.projectTable.findMany({
      where: eq(projectTable.workspaceId, ctx.activeWorkspaceId),
      with: {
        tasks: true,
      },
    });

    const projectsWithStatistics = await Promise.all(
      projects.map(async (project) => {
        // Get the full project structure with columns, plannedTasks, archivedTasks
        const fullProject = await getTasks(project.id);

        const totalTasks = project.tasks.length;
        const completedTasks = project.tasks.filter(
          (task) => task.status === "done" || task.status === "archived",
        ).length;
        const completionPercentage =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const dueDate = project.tasks.reduce((earliest: Date | null, task) => {
          if (!earliest || (task.dueDate && task.dueDate < earliest))
            return task.dueDate;
          return earliest;
        }, null);

        return {
          ...fullProject,
          createdAt: project.createdAt,
          tasks: project.tasks,
          statistics: {
            completionPercentage,
            totalTasks,
            dueDate,
          },
        };
      }),
    );

    return projectsWithStatistics;
  }),

  // Get a public project (no auth required)
  getPublic: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const project = await getTasks(input.id);

      if (!project) {
        throw new Error("Project not found");
      }

      if (!project.isPublic) {
        throw new Error("Project is not public");
      }

      // Add createdAt and tasks array for backward compatibility
      const projectWithTasks = await db.query.projectTable.findFirst({
        where: eq(projectTable.id, input.id),
        with: {
          tasks: true,
        },
      });

      return {
        ...project,
        createdAt: projectWithTasks?.createdAt,
        tasks: projectWithTasks?.tasks || [],
      };
    }),

  // Update a project
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        icon: z.string().optional(),
        slug: z.string().optional(),
        description: z.string().optional(),
        isPublic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;

      const [updatedProject] = await db
        .update(projectTable)
        .set(updateData)
        .where(eq(projectTable.id, id))
        .returning();

      return updatedProject;
    }),

  // Delete a project
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.delete(projectTable).where(eq(projectTable.id, input.id));
    }),
});
