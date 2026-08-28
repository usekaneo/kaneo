import { z } from "../openapi";

export const gitlabTokenType = z.enum(["pat", "oauth2"]).openapi({
  description:
    "`pat` sends the token as PRIVATE-TOKEN (personal, project, or group access token); `oauth2` sends it as a bearer token.",
});

const baseUrl = z.url().openapi({
  description:
    "Root URL of the GitLab instance. Must be https, since the access token is sent on every request; plain http needs KANEO_ALLOW_INSECURE_GITLAB_URL and still only reaches a private address.",
});

const gitlabCredentials = {
  projectId: z.string().min(1),
  baseUrl,
  accessToken: z.string().min(1),
  tokenType: gitlabTokenType.optional(),
};

export const listGitlabProjectsBody = z.object(gitlabCredentials);

export const verifyGitlabBody = z.object({
  ...gitlabCredentials,
  namespace: z.string().min(1),
  projectPath: z.string().min(1),
});

export const createGitlabBody = z.object({
  baseUrl,
  accessToken: z.string().optional().openapi({
    description: "Omit to keep the token already stored for this project.",
  }),
  tokenType: gitlabTokenType.optional(),
  namespace: z.string().min(1).openapi({
    description:
      "Group path the project lives under, including subgroups, e.g. `acme/platform`.",
  }),
  projectPath: z.string().min(1).openapi({
    description: "Project path only, without the namespace.",
  }),
});

export const updateGitlabBody = z.object({
  isActive: z.boolean().optional(),
  commentTaskLinkOnGitlabIssue: z.boolean().optional(),
});
