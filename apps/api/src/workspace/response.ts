import {
  WORKSPACE_CAPABILITY_NAMES,
  type WorkspaceCapability,
} from "@kaneo/permissions";
import { PROJECT_ACCESS_MODES } from "../project-access/project-access-mode";
import { responseTimestamp, z } from "../openapi";

export const workspaceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    role: z.string().nullable().openapi({
      description:
        "The caller's workspace role: a built-in role (owner, admin, member, viewer) or the name of a custom role defined in the workspace. Several roles are comma-separated, for example owner,viewer. Null when an instance admin views a workspace they are not a member of.",
    }),
  })
  .openapi("Workspace");

export const workspaceListSchema = z.array(workspaceSchema);

export const workspaceMemberSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().openapi({
      description:
        "The member's workspace role: a built-in role (owner, admin, member, viewer) or the name of a custom role defined in the workspace. Several roles are comma-separated, for example owner,viewer.",
    }),
  })
  .openapi("WorkspaceMember");

export const workspaceMemberListSchema = z.array(workspaceMemberSchema);

export const memberProjectAccessSchema = z
  .object({
    userId: z.string(),
    projectAccess: z.enum(PROJECT_ACCESS_MODES),
    projectIds: z.array(z.string()),
  })
  .openapi("MemberProjectAccess");

export const memberProjectAccessListSchema = z
  .array(memberProjectAccessSchema)
  .openapi({
    description:
      "Members limited to selected projects. Members not listed can access every project. Project IDs only include projects the caller can access.",
  });

const capabilityShape = Object.fromEntries(
  WORKSPACE_CAPABILITY_NAMES.map((name) => [name, z.boolean()]),
) as Record<WorkspaceCapability, z.ZodBoolean>;

export const workspaceCapabilitiesSchema = z
  .object(capabilityShape)
  .openapi("WorkspaceCapabilities", {
    description:
      "Whether the caller's roles (and API key scope, if any) allow each named action in the workspace. Mirrors the checks the API enforces.",
  });
