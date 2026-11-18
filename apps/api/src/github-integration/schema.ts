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
  search: z.string().trim().max(100).optional().openapi({
    description:
      "Case-insensitive match on the repository full name or description. When set, one request scans up to 10 pages of 100 repositories across installations and returns every match it finds, with `nextPage` set to resume the scan.",
  }),
});

export const importGitHubBody = z.object({
  // RFC 0001 WP2: imports are keyed by the integration id of the binding.
  integrationId: z.string().min(1).max(128),
  // Compat: the old project-keyed body sent projectId; when present it must
  // match the binding's project (404 otherwise).
  projectId: z.string().min(1).max(128).optional(),
  runId: z.string().min(1).max(128).optional(),
});
