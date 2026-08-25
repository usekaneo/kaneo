import { z } from "../openapi";

const giteaCredentials = {
  projectId: z.string().min(1),
  baseUrl: z.url(),
  accessToken: z.string().min(1),
};

export const listGiteaRepositoriesBody = z.object(giteaCredentials);

export const verifyGiteaBody = z.object({
  ...giteaCredentials,
  repositoryOwner: z.string().min(1),
  repositoryName: z.string().min(1),
});

export const createGiteaBody = z.object({
  baseUrl: z.string().min(1),
  accessToken: z.string().optional().openapi({
    description: "Omit to keep the token already stored for this project.",
  }),
  repositoryOwner: z.string().min(1),
  repositoryName: z.string().min(1),
});

export const updateGiteaBody = z.object({
  isActive: z.boolean().optional(),
  commentTaskLinkOnGiteaIssue: z.boolean().optional(),
});
