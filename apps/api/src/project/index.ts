import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireEntitlement } from "../billing/require-entitlement-middleware";
import db from "../database";
import { projectTable } from "../database/schema";
import { projectSchema, uploadProjectBackgroundSchema } from "../schemas";
import {
  assertProjectBackgroundKeyMatchesContext,
  createProjectBackgroundUploadUrl,
  deleteS3Object,
  getPrivateObject,
  isImageContentType,
  validateProjectBackgroundUploadInput,
} from "../storage/s3";
import { normalizeApiServerUrl } from "../utils/openapi-spec";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import archiveProjectCtrl from "./controllers/archive-project";
import createProjectCtrl from "./controllers/create-project";
import deleteProjectCtrl from "./controllers/delete-project";
import getProjectCtrl from "./controllers/get-project";
import getProjectsCtrl from "./controllers/get-projects";
import reorderProjectsCtrl from "./controllers/reorder-projects";
import unarchiveProjectCtrl from "./controllers/unarchive-project";
import updateProjectCtrl from "./controllers/update-project";

const project = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listProjects",
      tags: ["Projects"],
      description: "Get all projects in a workspace",
      responses: {
        200: {
          description: "List of projects with statistics",
          content: {
            "application/json": { schema: resolver(v.array(projectSchema)) },
          },
        },
      },
    }),
    validator(
      "query",
      v.object({
        workspaceId: v.string(),
        includeArchived: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromQuery(),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const { includeArchived } = c.req.valid("query");
      const projects = await getProjectsCtrl(
        workspaceId,
        includeArchived === "true",
      );
      return c.json(projects);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createProject",
      tags: ["Projects"],
      description: "Create a new project in a workspace",
      responses: {
        200: {
          description: "Project created successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        name: v.string(),
        workspaceId: v.string(),
        icon: v.string(),
        slug: v.string(),
      }),
    ),
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ project: ["create"] }),
    requireEntitlement,
    async (c) => {
      const { name, icon, slug } = c.req.valid("json");
      const workspaceId = c.get("workspaceId");
      const newProject = await createProjectCtrl(workspaceId, name, icon, slug);
      return c.json(newProject);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getProject",
      tags: ["Projects"],
      description: "Get a specific project by ID",
      responses: {
        200: {
          description: "Project details",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const projectData = await getProjectCtrl(id, workspaceId);
      return c.json(projectData);
    },
  )
  .get(
    "/:id/background",
    describeRoute({
      operationId: "getProjectBackground",
      tags: ["Projects"],
      description: "Get the current project board background image",
      responses: {
        200: {
          description: "The project background image",
          content: {
            "image/*": { schema: { type: "string", format: "binary" } },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    async (c) => {
      const { id } = c.req.valid("param");
      const [projectData] = await db
        .select({
          backgroundObjectKey: projectTable.backgroundObjectKey,
          backgroundMimeType: projectTable.backgroundMimeType,
          backgroundVersion: projectTable.backgroundVersion,
        })
        .from(projectTable)
        .where(eq(projectTable.id, id))
        .limit(1);

      if (!projectData?.backgroundObjectKey) {
        throw new HTTPException(404, {
          message: "Project background not found",
        });
      }

      try {
        const object = await getPrivateObject(projectData.backgroundObjectKey);
        const contentType = (
          object.contentType ||
          projectData.backgroundMimeType ||
          ""
        )
          .toLowerCase()
          .split(";")[0]
          ?.trim();

        if (!contentType || !isImageContentType(contentType)) {
          throw new HTTPException(404, {
            message: "Project background not found",
          });
        }

        const etag = object.etag || `"${projectData.backgroundVersion}"`;
        const headers: Record<string, string> = {
          "Cache-Control": "private, max-age=300, must-revalidate",
          "Content-Type": contentType,
          ETag: etag,
          Vary: "Cookie, Authorization",
          "X-Content-Type-Options": "nosniff",
        };
        if (object.contentLength !== undefined) {
          headers["Content-Length"] = object.contentLength.toString();
        }
        if (object.lastModified) {
          headers["Last-Modified"] = object.lastModified.toUTCString();
        }

        if (c.req.header("If-None-Match") === etag) {
          return new Response(null, { status: 304, headers });
        }

        return new Response(object.body as BodyInit, { headers });
      } catch (error) {
        if (error instanceof HTTPException) throw error;
        console.error("Failed to stream project background:", error);
        throw new HTTPException(404, {
          message: "Project background not found",
        });
      }
    },
  )
  .put(
    "/reorder",
    describeRoute({
      operationId: "reorderProjects",
      tags: ["Projects"],
      description: "Reorder projects in a workspace",
      responses: {
        200: {
          description: "Projects reordered successfully",
          content: {
            "application/json": { schema: resolver(v.array(projectSchema)) },
          },
        },
      },
    }),
    validator("query", v.object({ workspaceId: v.string() })),
    validator(
      "json",
      v.object({
        // Positions express a relative order only; the controller renumbers
        // the workspace to 0..n-1, so the values just have to be sane.
        projects: v.pipe(
          v.array(
            v.object({
              id: v.string(),
              position: v.pipe(v.number(), v.integer(), v.minValue(0)),
            }),
          ),
          v.minLength(1),
        ),
      }),
    ),
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const { projects } = c.req.valid("json");
      const reordered = await reorderProjectsCtrl(workspaceId, projects);
      return c.json(reordered);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateProject",
      tags: ["Projects"],
      description: "Update an existing project",
      responses: {
        200: {
          description: "Project updated successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.string(),
        icon: v.string(),
        slug: v.string(),
        description: v.string(),
        isPublic: v.boolean(),
      }),
    ),
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, icon, slug, description, isPublic } = c.req.valid("json");
      const workspaceId = c.get("workspaceId");
      const updatedProject = await updateProjectCtrl(
        id,
        name,
        icon,
        slug,
        description,
        isPublic,
        workspaceId,
      );
      return c.json(updatedProject);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteProject",
      tags: ["Projects"],
      description: "Delete a project by ID",
      responses: {
        200: {
          description: "Project deleted successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["delete"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const deletedProject = await deleteProjectCtrl(id, workspaceId);
      return c.json(deletedProject);
    },
  )
  .put(
    "/:id/archive",
    describeRoute({
      operationId: "archiveProject",
      tags: ["Projects"],
      description: "Archive a project by ID",
      responses: {
        200: {
          description: "Project archived successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const archivedProject = await archiveProjectCtrl(id, workspaceId);
      return c.json(archivedProject);
    },
  )
  .put(
    "/:id/unarchive",
    describeRoute({
      operationId: "unarchiveProject",
      tags: ["Projects"],
      description: "Unarchive a project by ID",
      responses: {
        200: {
          description: "Project unarchived successfully",
          content: {
            "application/json": { schema: resolver(projectSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const unarchivedProject = await unarchiveProjectCtrl(id, workspaceId);
      return c.json(unarchivedProject);
    },
  )
  .put(
    "/:id/background-upload",
    describeRoute({
      operationId: "uploadProjectBackground",
      tags: ["Projects"],
      description:
        "Create a presigned background image upload URL for a project",
      responses: {
        200: {
          description: "Background image upload URL created successfully",
          content: {
            "application/json": {
              schema: resolver(uploadProjectBackgroundSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        contentType: v.string(),
        size: v.number(),
      }),
    ),
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    requireEntitlement,
    async (c) => {
      const { id } = c.req.valid("param");
      const { contentType, size } = c.req.valid("json");

      try {
        validateProjectBackgroundUploadInput(contentType, size);
      } catch (error) {
        throw new HTTPException(400, {
          message:
            error instanceof Error
              ? error.message
              : "Invalid image upload request",
        });
      }

      const [projectContext] = await db
        .select({
          projectId: projectTable.id,
          workspaceId: projectTable.workspaceId,
        })
        .from(projectTable)
        .where(eq(projectTable.id, id))
        .limit(1);

      if (!projectContext) {
        throw new HTTPException(404, { message: "Project not found" });
      }

      try {
        const upload = await createProjectBackgroundUploadUrl({
          workspaceId: projectContext.workspaceId,
          projectId: projectContext.projectId,
          contentType,
          size,
        });

        return c.json(upload);
      } catch (error) {
        throw new HTTPException(503, {
          message:
            error instanceof Error
              ? error.message
              : "Image uploads are not configured",
        });
      }
    },
  )
  .post(
    "/:id/background-upload/finalize",
    describeRoute({
      operationId: "finalizeProjectBackgroundUpload",
      tags: ["Projects"],
      description: "Finalize an uploaded project background",
      responses: {
        200: {
          description: "Image upload finalized successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        key: v.string(),
        contentType: v.string(),
        version: v.string(),
        size: v.number(),
      }),
    ),
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    requireEntitlement,
    async (c) => {
      const { id } = c.req.valid("param");
      const { key, contentType, size, version } = c.req.valid("json");

      try {
        validateProjectBackgroundUploadInput(contentType, size);
      } catch (error) {
        throw new HTTPException(400, {
          message:
            error instanceof Error
              ? error.message
              : "Invalid image upload request",
        });
      }

      const [projectContext] = await db
        .select({
          projectId: projectTable.id,
          workspaceId: projectTable.workspaceId,
        })
        .from(projectTable)
        .where(eq(projectTable.id, id))
        .limit(1);

      if (!projectContext) {
        throw new HTTPException(404, { message: "Project not found" });
      }

      const normalizedKey = key.trim();
      if (
        !assertProjectBackgroundKeyMatchesContext(normalizedKey, {
          workspaceId: projectContext.workspaceId,
          projectId: projectContext.projectId,
          version,
        })
      ) {
        throw new HTTPException(400, {
          message: "Image upload key does not match the task context.",
        });
      }

      const [currentProject] = await db
        .select({ backgroundObjectKey: projectTable.backgroundObjectKey })
        .from(projectTable)
        .where(eq(projectTable.id, id))
        .limit(1);

      const [updatedProject] = await db
        .update(projectTable)
        .set({
          backgroundObjectKey: normalizedKey,
          backgroundMimeType: contentType,
          backgroundVersion: version,
        })
        .where(eq(projectTable.id, id))
        .returning({ id: projectTable.id });

      if (!updatedProject) {
        throw new HTTPException(500, { message: "Failed to save background" });
      }

      if (
        currentProject?.backgroundObjectKey &&
        currentProject.backgroundObjectKey !== normalizedKey
      ) {
        deleteS3Object(currentProject.backgroundObjectKey).catch(() => {});
      }

      const apiBaseUrl = normalizeApiServerUrl(
        process.env.KANEO_API_URL || new URL(c.req.url).origin,
      );
      return c.json({
        url: `${apiBaseUrl}/project/${updatedProject.id}/background?v=${encodeURIComponent(version)}`,
      });
    },
  )
  .delete(
    "/:id/background",
    describeRoute({
      operationId: "deleteProjectBackground",
      tags: ["Projects"],
      description: "Remove the current project board background image",
      responses: { 204: { description: "Project background removed" } },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const [currentProject] = await db
        .select({ backgroundObjectKey: projectTable.backgroundObjectKey })
        .from(projectTable)
        .where(eq(projectTable.id, id))
        .limit(1);

      const [updatedProject] = await db
        .update(projectTable)
        .set({
          backgroundObjectKey: null,
          backgroundMimeType: null,
          backgroundVersion: null,
        })
        .where(eq(projectTable.id, id))
        .returning({ id: projectTable.id });

      if (updatedProject && currentProject?.backgroundObjectKey) {
        deleteS3Object(currentProject.backgroundObjectKey).catch(() => {});
      }

      return c.body(null, 204);
    },
  );

export default project;
