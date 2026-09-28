import { z } from "../openapi";

const repositoryRef = {
  repositoryOwner: z.string().min(1).max(100),
  repositoryName: z.string().min(1).max(100),
};

export const verifyGitHubBody = z.object({
  projectId: z.string().min(1),
  ...repositoryRef,
});

export const createGitHubBody = z.object(repositoryRef);

export const updateGitHubBody = z.object({
  isActive: z.boolean().optional(),
  commentTaskLinkOnGitHubIssue: z.boolean().optional(),
});

export const repositoryPageQuery = z.object({
  installationPage: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .default("1")
    .transform(Number),
  repositoryPage: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .default("1")
    .transform(Number),
});

export const importGitHubBody = z.object({
  projectId: z.string().min(1).max(128),
  runId: z.string().min(1).max(128).optional(),
});
