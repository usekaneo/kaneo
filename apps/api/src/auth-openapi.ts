import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "./openapi";

// Better Auth serves /api/auth/* from its own handler, so these operations have
// no route of ours to hang documentation off. They are registered directly on
// the OpenAPI registry instead.
//
// This file is generated from Better Auth's own generateOpenAPISchema() output
// and then reviewed. Declaring it here replaced a runtime call to that
// generator plus ~200 lines of spec rewriting (operationId/summary/tag
// normalization, ref pruning, and a 3.1-to-3.0 downgrade). Regenerate and diff
// this file when upgrading Better Auth.
export function organizationRoutes(registry: OpenAPIHono["openAPIRegistry"]) {
  registry.registerPath({
    method: "post",
    path: "/auth/organization/accept-invitation",
    tags: ["Organization Management"],
    operationId: "acceptOrganizationInvitation",
    summary: "Accept Organization Invitation",
    description: "Accept an invitation to an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              invitationId: z
                .string()
                .openapi({ description: "The ID of the invitation to accept" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              invitation: z.record(z.string(), z.unknown()).optional(),
              member: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/add-team-member",
    tags: ["Organization Management"],
    operationId: "addOrganizationTeamMember",
    summary: "Add Organization Team Member",
    description: "The newly created member",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              teamId: z.string().openapi({
                description: "The team the user should be a member of.",
              }),
              userId: z.string().openapi({
                description:
                  "The user Id which represents the user to be added as a member.",
              }),
              organizationId: z.string().optional().openapi({
                description:
                  "The organization ID which the team falls under. If not provided, it will default to the user's active organization.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().openapi({
                description: "Unique identifier of the team member",
              }),
              userId: z
                .string()
                .openapi({ description: "The user ID of the team member" }),
              teamId: z.string().openapi({
                description: "The team ID of the team the team member is in",
              }),
              createdAt: z.string().openapi({
                description: "Timestamp when the team member was created",
              }),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/cancel-invitation",
    tags: ["Organization Management"],
    operationId: "cancelOrganizationInvitation",
    summary: "Cancel Organization Invitation",
    description: "Cancel Organization Invitation",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              invitationId: z
                .string()
                .openapi({ description: "The ID of the invitation to cancel" }),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/check-slug",
    tags: ["Organization Management"],
    operationId: "checkOrganizationSlug",
    summary: "Check Organization Slug",
    description: "Check Organization Slug",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              slug: z.string().openapi({
                description: 'The organization slug to check. Eg: "my-org"',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/create",
    tags: ["Organization Management"],
    operationId: "createOrganization",
    summary: "Create Organization",
    description: "Create an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              name: z
                .string()
                .openapi({ description: "The name of the organization" }),
              slug: z
                .string()
                .openapi({ description: "The slug of the organization" }),
              userId: z.string().optional().openapi({
                description:
                  'The user id of the organization creator. If not provided, the current user will be used. Should only be used by admins or when called by the server. server-only. Eg: "user-id"',
              }),
              logo: z
                .string()
                .nullable()
                .optional()
                .openapi({ description: "The logo of the organization" }),
              metadata: z
                .record(z.string(), z.unknown())
                .optional()
                .openapi({ description: "The metadata of the organization" }),
              keepCurrentActiveOrganization: z.boolean().optional().openapi({
                description:
                  "Whether to keep the current active organization active after creating a new one. Eg: true",
              }),
              description: z.string().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.unknown() } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/create-role",
    tags: ["Organization Management"],
    operationId: "createOrganizationRole",
    summary: "Create Organization Role",
    description: "Create Organization Role",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              organizationId: z.string().optional(),
              role: z
                .string()
                .openapi({ description: "The name of the role to create" }),
              permission: z.record(z.string(), z.array(z.string())).openapi({
                description: "The permission to assign to the role",
              }),
              additionalFields: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/create-team",
    tags: ["Organization Management"],
    operationId: "createOrganizationTeam",
    summary: "Create Organization Team",
    description: "Create a new team within an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().openapi({
                description: 'The name of the team. Eg: "my-team"',
              }),
              organizationId: z.string().optional().openapi({
                description:
                  'The organization ID which the team will be created in. Defaults to the active organization. Eg: "organization-id"',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().openapi({
                description: "Unique identifier of the created team",
              }),
              name: z.string().openapi({ description: "Name of the team" }),
              organizationId: z.string().openapi({
                description: "ID of the organization the team belongs to",
              }),
              createdAt: z.string().openapi({
                description: "Timestamp when the team was created",
              }),
              updatedAt: z.string().openapi({
                description: "Timestamp when the team was last updated",
              }),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/delete",
    tags: ["Organization Management"],
    operationId: "deleteOrganization",
    summary: "Delete Organization",
    description: "Delete an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              organizationId: z
                .string()
                .openapi({ description: "The organization id to delete" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.string() } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/delete-role",
    tags: ["Organization Management"],
    operationId: "deleteOrganizationRole",
    summary: "Delete Organization Role",
    description: "Delete Organization Role",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.intersection(
              z.object({
                organizationId: z.string().optional(),
              }),
              z.union([
                z.object({
                  roleName: z
                    .string()
                    .openapi({ description: "The name of the role to delete" }),
                }),
                z.object({
                  roleId: z
                    .string()
                    .openapi({ description: "The id of the role to delete" }),
                }),
              ]),
            ),
          },
        },
      },
    },
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/get-active-member",
    tags: ["Organization Management"],
    operationId: "getOrganizationActiveMember",
    summary: "Get Organization Active Member",
    description: "Get the member details of the active organization",
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string(),
              userId: z.string(),
              organizationId: z.string(),
              role: z.string(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/get-active-member-role",
    tags: ["Organization Management"],
    operationId: "getOrganizationActiveMemberRole",
    summary: "Get Organization Active Member Role",
    description: "Get Organization Active Member Role",
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/get-full-organization",
    tags: ["Organization Management"],
    operationId: "getOrganizationFullOrganization",
    summary: "Get Organization Full Organization",
    description: "Get the full organization",
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.unknown() } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/get-invitation",
    tags: ["Organization Management"],
    operationId: "getOrganizationInvitation",
    summary: "Get Organization Invitation",
    description: "Get an invitation by ID",
    request: {
      query: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string(),
              email: z.string(),
              role: z.string(),
              organizationId: z.string(),
              inviterId: z.string(),
              status: z.string(),
              expiresAt: z.string(),
              organizationName: z.string(),
              organizationSlug: z.string(),
              inviterEmail: z.string(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/get-role",
    tags: ["Organization Management"],
    operationId: "getOrganizationRole",
    summary: "Get Organization Role",
    description: "Get Organization Role",
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/has-permission",
    tags: ["Organization Management"],
    operationId: "hasOrganizationPermission",
    summary: "Check Organization Permission",
    description: "Check if the user has permission",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              permission: z
                .record(z.string(), z.unknown())
                .optional()
                .openapi({ description: "The permission to check" }),
              permissions: z
                .record(z.string(), z.unknown())
                .openapi({ description: "The permission to check" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().optional(),
              success: z.boolean(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/invite-member",
    tags: ["Organization Management"],
    operationId: "inviteOrganizationMember",
    summary: "Invite Organization Member",
    description: "Create an invitation to an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              email: z.string().openapi({
                description: "The email address of the user to invite",
              }),
              role: z.union([z.string(), z.array(z.string())]).openapi({
                description:
                  'The role(s) to assign to the user. It can be `admin`, `member`, owner. Eg: "member"',
              }),
              organizationId: z.string().optional().openapi({
                description: "The organization ID to invite the user to",
              }),
              resend: z.boolean().optional().openapi({
                description:
                  "Resend the invitation email, if the user is already invited. Eg: true",
              }),
              teamId: z.union([z.string(), z.array(z.string())]).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string(),
              email: z.string(),
              role: z.string(),
              organizationId: z.string(),
              inviterId: z.string(),
              status: z.string(),
              expiresAt: z.string(),
              createdAt: z.string(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/leave",
    tags: ["Organization Management"],
    operationId: "leaveOrganization",
    summary: "Leave Organization",
    description: "Leave Organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              organizationId: z.string().openapi({
                description:
                  'The organization Id for the member to leave. Eg: "organization-id"',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list",
    tags: ["Organization Management"],
    operationId: "listOrganization",
    summary: "List Organization",
    description: "List all organizations",
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.array(z.unknown()) } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list-invitations",
    tags: ["Organization Management"],
    operationId: "listOrganizationInvitations",
    summary: "List Organization Invitations",
    description: "List Organization Invitations",
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list-members",
    tags: ["Organization Management"],
    operationId: "listOrganizationMembers",
    summary: "List Organization Members",
    description: "List Organization Members",
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list-roles",
    tags: ["Organization Management"],
    operationId: "listOrganizationRoles",
    summary: "List Organization Roles",
    description: "List Organization Roles",
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list-team-members",
    tags: ["Organization Management"],
    operationId: "listOrganizationTeamMembers",
    summary: "List Organization Team Members",
    description: "List the members of the given team.",
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                id: z.string().openapi({
                  description: "Unique identifier of the team member",
                }),
                userId: z
                  .string()
                  .openapi({ description: "The user ID of the team member" }),
                teamId: z.string().openapi({
                  description: "The team ID of the team the team member is in",
                }),
                createdAt: z.string().openapi({
                  description: "Timestamp when the team member was created",
                }),
              }),
            ),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list-teams",
    tags: ["Organization Management"],
    operationId: "listOrganizationTeams",
    summary: "List Organization Teams",
    description: "List all teams in an organization",
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                id: z
                  .string()
                  .openapi({ description: "Unique identifier of the team" }),
                name: z.string().openapi({ description: "Name of the team" }),
                organizationId: z.string().openapi({
                  description: "ID of the organization the team belongs to",
                }),
                createdAt: z.string().openapi({
                  description: "Timestamp when the team was created",
                }),
                updatedAt: z.string().openapi({
                  description: "Timestamp when the team was last updated",
                }),
              }),
            ),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list-user-invitations",
    tags: ["Organization Management"],
    operationId: "listOrganizationUserInvitations",
    summary: "List Organization User Invitations",
    description: "List all invitations a user has received",
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                id: z.string(),
                email: z.string(),
                role: z.string(),
                organizationId: z.string(),
                organizationName: z.string(),
                inviterId: z.string().openapi({
                  description: "The ID of the user who created the invitation",
                }),
                teamId: z.string().nullable().optional().openapi({
                  description:
                    "The ID of the team associated with the invitation",
                }),
                status: z.string(),
                expiresAt: z.string(),
                createdAt: z.string(),
              }),
            ),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/organization/list-user-teams",
    tags: ["Organization Management"],
    operationId: "listOrganizationUserTeams",
    summary: "List Organization User Teams",
    description: "List all teams that the current user is a part of.",
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.array(z.unknown()) } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/reject-invitation",
    tags: ["Organization Management"],
    operationId: "rejectOrganizationInvitation",
    summary: "Reject Organization Invitation",
    description: "Reject an invitation to an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              invitationId: z
                .string()
                .openapi({ description: "The ID of the invitation to reject" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              invitation: z.record(z.string(), z.unknown()).optional(),
              member: z.record(z.string(), z.unknown()).nullable().optional(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/remove-member",
    tags: ["Organization Management"],
    operationId: "removeOrganizationMember",
    summary: "Remove Organization Member",
    description: "Remove a member from an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              memberIdOrEmail: z.string().openapi({
                description: "The ID or email of the member to remove",
              }),
              organizationId: z.string().optional().openapi({
                description:
                  'The ID of the organization to remove the member from. If not provided, the active organization will be used. Eg: "org-id"',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              member: z.object({
                id: z.string(),
                userId: z.string(),
                organizationId: z.string(),
                role: z.string(),
              }),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/remove-team",
    tags: ["Organization Management"],
    operationId: "removeOrganizationTeam",
    summary: "Remove Organization Team",
    description: "Remove a team from an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              teamId: z.string().openapi({
                description: 'The team ID of the team to remove. Eg: "team-id"',
              }),
              organizationId: z.string().optional().openapi({
                description:
                  'The organization ID which the team falls under. If not provided, it will default to the user\'s active organization. Eg: "organization-id"',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              message: z.enum(["Team removed successfully."]).openapi({
                description:
                  "Confirmation message indicating successful removal",
              }),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/remove-team-member",
    tags: ["Organization Management"],
    operationId: "removeOrganizationTeamMember",
    summary: "Remove Organization Team Member",
    description: "Remove a member from a team",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              teamId: z.string().openapi({
                description: "The team the user should be removed from.",
              }),
              userId: z.string().openapi({
                description: "The user which should be removed from the team.",
              }),
              organizationId: z.string().optional().openapi({
                description:
                  "The organization ID which the team falls under. If not provided, it will default to the user's active organization.",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              message: z.enum(["Team member removed successfully."]).openapi({
                description:
                  "Confirmation message indicating successful removal",
              }),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/set-active",
    tags: ["Organization Management"],
    operationId: "setOrganizationActive",
    summary: "Set Organization Active",
    description: "Set the active organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              organizationId: z.string().nullable().optional().openapi({
                description:
                  'The organization id to set as active. It can be null to unset the active organization. Eg: "org-id"',
              }),
              organizationSlug: z.string().optional().openapi({
                description:
                  'The organization slug to set as active. It can be null to unset the active organization if organizationId is not provided. Eg: "org-slug"',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.unknown() } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/set-active-team",
    tags: ["Organization Management"],
    operationId: "setOrganizationActiveTeam",
    summary: "Set Organization Active Team",
    description: "Set the active team for the current active organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              teamId: z.string().nullable().optional().openapi({
                description:
                  "The team id to set as active. It can be null to unset the active team",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.unknown() } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/update",
    tags: ["Organization Management"],
    operationId: "updateOrganization",
    summary: "Update Organization",
    description: "Update an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              data: z.object({
                description: z.string().nullable().optional(),
                name: z
                  .string()
                  .optional()
                  .openapi({ description: "The name of the organization" }),
                slug: z
                  .string()
                  .optional()
                  .openapi({ description: "The slug of the organization" }),
                logo: z
                  .string()
                  .nullable()
                  .optional()
                  .openapi({ description: "The logo of the organization" }),
                metadata: z
                  .record(z.string(), z.unknown())
                  .optional()
                  .openapi({ description: "The metadata of the organization" }),
              }),
              organizationId: z
                .string()
                .optional()
                .openapi({ description: 'The organization ID. Eg: "org-id"' }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: z.unknown() } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/update-member-role",
    tags: ["Organization Management"],
    operationId: "updateOrganizationMemberRole",
    summary: "Update Organization Member Role",
    description: "Update the role of a member in an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              role: z.union([z.string(), z.array(z.string())]).openapi({
                description:
                  'The new role to be applied. This can be a string or array of strings representing the roles. Eg: ["admin", "sale"]',
              }),
              memberId: z.string().openapi({
                description:
                  'The member id to apply the role update to. Eg: "member-id"',
              }),
              organizationId: z.string().optional().openapi({
                description:
                  'An optional organization ID which the member is a part of to apply the role update. If not provided, you must provide session headers to get the active organization. Eg: "organization-id"',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              member: z.object({
                id: z.string(),
                userId: z.string(),
                organizationId: z.string(),
                role: z.string(),
              }),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/update-role",
    tags: ["Organization Management"],
    operationId: "updateOrganizationRole",
    summary: "Update Organization Role",
    description: "Update Organization Role",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.intersection(
              z.object({
                organizationId: z.string().optional(),
                data: z.object({
                  permission: z
                    .record(z.string(), z.array(z.string()))
                    .optional(),
                  roleName: z.string().optional(),
                }),
              }),
              z.union([
                z.object({
                  roleName: z
                    .string()
                    .openapi({ description: "The name of the role to update" }),
                }),
                z.object({
                  roleId: z
                    .string()
                    .openapi({ description: "The id of the role to update" }),
                }),
              ]),
            ),
          },
        },
      },
    },
    responses: {
      200: { description: "Success" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/organization/update-team",
    tags: ["Organization Management"],
    operationId: "updateOrganizationTeam",
    summary: "Update Organization Team",
    description: "Update an existing team in an organization",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              teamId: z.string().openapi({
                description: 'The ID of the team to be updated. Eg: "team-id"',
              }),
              data: z.object({
                id: z.string().optional(),
                name: z.string().optional(),
                organizationId: z.string().optional(),
                createdAt: z.string().optional(),
                updatedAt: z.string().optional(),
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().openapi({
                description: "Unique identifier of the updated team",
              }),
              name: z
                .string()
                .openapi({ description: "Updated name of the team" }),
              organizationId: z.string().openapi({
                description: "ID of the organization the team belongs to",
              }),
              createdAt: z.string().openapi({
                description: "Timestamp when the team was created",
              }),
              updatedAt: z.string().openapi({
                description: "Timestamp when the team was last updated",
              }),
            }),
          },
        },
      },
    },
  });
}
