import { z } from "../openapi";

const giteaCredentials = {
  projectId: z.string().min(1),
  baseUrl: z.url(),
  accessToken: z.string().min(1),
};

export const listGiteaRepositoriesBody = z.object(giteaCredentials);

export const verifyGiteaBody = z.object({
  ...giteaCredentials,
  accessToken: z.string().min(1).optional().openapi({
    description:
      "Omit to verify with this project's saved token. The base URL must match the saved integration.",
  }),
  repositoryOwner: z.string().min(1),
  repositoryName: z.string().min(1),
});

export const createGiteaBody = z.object({
  baseUrl: z.string().min(1),
  accessToken: z.string().optional().openapi({
    description:
      "Omit to reuse a token already stored for this project and instance.",
  }),
  repositoryOwner: z.string().min(1),
  repositoryName: z.string().min(1),
});

export const updateGiteaBody = z.object({
  isActive: z.boolean().optional(),
  commentTaskLinkOnGiteaIssue: z.boolean().optional(),
});

// RFC 0001 WP3: import is keyed by integration id; a projectId in the body is
// accepted for compat and must match the binding's project.
export const importGiteaIssuesBody = z.object({
  integrationId: z.string().min(1),
  projectId: z
    .string()
    .min(1)
    .optional()
    .openapi({
      description:
        "Compat only; when present it must match the binding's project.",
    }),
});
