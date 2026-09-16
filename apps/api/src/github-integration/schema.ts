import { z } from "../openapi";

const repositoryRef = {
  repositoryOwner: z.string().min(1),
  repositoryName: z.string().min(1),
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
