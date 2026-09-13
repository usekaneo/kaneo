import { z } from "../openapi";

const tokenType = z.enum(["private", "bearer"]).optional().openapi({
  description:
    "`private` sends the token in PRIVATE-TOKEN, which is what personal, project and group access tokens expect. `bearer` sends it in Authorization, for an OAuth2 token you already hold. Defaults to `private`.",
});

const gitlabCredentials = {
  projectId: z.string().min(1),
  baseUrl: z.url(),
  accessToken: z.string().min(1),
  tokenType,
};

export const listGitlabProjectsBody = z.object(gitlabCredentials);

export const verifyGitlabBody = z.object({
  ...gitlabCredentials,
  projectPath: z.string().min(1).openapi({
    description:
      "Full path of the GitLab project, including any nested groups, for example acme/platform/web.",
  }),
});

export const createGitlabBody = z.object({
  baseUrl: z.url(),
  accessToken: z.string().optional().openapi({
    description: "Omit to keep the token already stored for this project.",
  }),
  tokenType,
  projectPath: z.string().min(1),
});

export const updateGitlabBody = z.object({
  isActive: z.boolean().optional(),
  commentTaskLinkOnGitlabIssue: z.boolean().optional(),
});
