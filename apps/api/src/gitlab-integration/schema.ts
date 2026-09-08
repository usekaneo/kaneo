import { z } from "../openapi";

const gitlabCredentials = {
  projectId: z.string().min(1),
  baseUrl: z.url(),
  accessToken: z.string().min(1),
};

export const listGitlabRepositoriesBody = z.object(gitlabCredentials);

export const verifyGitlabBody = z.object({
  ...gitlabCredentials,
  repositoryPath: z.string().min(1),
});

export const createGitlabBody = z.object({
  baseUrl: z.string().min(1),
  accessToken: z.string().optional().openapi({
    description: "Omit to keep the token already stored for this project.",
  }),
  repositoryPath: z.string().min(1),
});

export const updateGitlabBody = z.object({
  isActive: z.boolean().optional(),
  commentTaskLinkOnGitlabIssue: z.boolean().optional(),
});
