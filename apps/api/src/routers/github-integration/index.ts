import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../../lib/trpc";
import createGithubIntegration from "./controllers/create-github-integration";
import deleteGithubIntegration from "./controllers/delete-github-integration";
import getGithubIntegration from "./controllers/get-github-integration";
import getGithubIntegrationByRepositoryId from "./controllers/get-github-integration-by-repository-id";
import { importIssues } from "./controllers/import-issues";
import listUserRepositories from "./controllers/list-user-repositories";
import verifyGithubInstallation from "./controllers/verify-github-installation";

export const githubIntegrationRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        repositoryOwner: z.string().min(1),
        repositoryName: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await createGithubIntegration(input);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create GitHub integration",
          cause: error,
        });
      }
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await getGithubIntegration(input.projectId);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GitHub integration not found",
          cause: error,
        });
      }
    }),

  getByRepository: protectedProcedure
    .input(
      z.object({
        repositoryOwner: z.string(),
        repositoryName: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await getGithubIntegrationByRepositoryId(
          input.repositoryOwner,
          input.repositoryName,
        );
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get GitHub integration by repository",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await deleteGithubIntegration(input.projectId);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete GitHub integration",
          cause: error,
        });
      }
    }),

  listRepositories: protectedProcedure.query(async () => {
    try {
      const result = await listUserRepositories();
      return result;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list user repositories",
        cause: error,
      });
    }
  }),

  verifyInstallation: protectedProcedure
    .input(
      z.object({
        repositoryOwner: z.string().min(1),
        repositoryName: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await verifyGithubInstallation(input);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify GitHub installation",
          cause: error,
        });
      }
    }),

  importIssues: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await importIssues(input.projectId);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to import GitHub issues",
          cause: error,
        });
      }
    }),

  getAppInfo: protectedProcedure.query(async () => {
    try {
      return {
        appName: process.env.GITHUB_APP_NAME || null,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get GitHub app info",
        cause: error,
      });
    }
  }),
});
