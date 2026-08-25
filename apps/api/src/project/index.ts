import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { requireEntitlement } from "../billing/require-entitlement-middleware";
import db from "../database";
import { projectTable } from "../database/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
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
import {
  projectBackgroundFinalizeSchema,
  projectBackgroundUploadSchema,
  projectListSchema,
  projectSchema,
} from "./response";
import {
  createProjectBody,
  finalizeProjectBackgroundBody,
  listProjectsQuery,
  projectParam,
  reorderProjectsBody,
  updateProjectBody,
  uploadProjectBackgroundBody,
  workspaceIdQuery,
} from "./schema";

const listProjectsRoute = createRoute({
  method: "get",
  operationId: "listProjects",
  path: "/",
  tags: ["Projects"],
  summary: "List projects",
  description:
    "List a workspace's projects in sidebar order, each with rollup task statistics. Archived projects are excluded unless includeArchived is set.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: listProjectsQuery },
  responses: {
    200: jsonResponse("List of projects", projectListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const createProjectRoute = createRoute({
  method: "post",
  operationId: "createProject",
  path: "/",
  tags: ["Projects"],
  summary: "Create project",
  description:
    "Create a project in a workspace. The slug becomes the prefix of its task identifiers.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ project: ["create"] }),
    requireEntitlement,
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createProjectBody } },
    },
  },
  responses: {
    200: jsonResponse("The created project", projectSchema),
    400: errorResponse("Invalid body, or workspace ID could not be determined"),
    403: errorResponse(
      "No workspace access, or missing project:create permission",
    ),
  },
});

const getProjectRoute = createRoute({
  method: "get",
  operationId: "getProject",
  path: "/{id}",
  tags: ["Projects"],
  summary: "Get project",
  description: "Get a single project by ID.",
  middleware: [workspaceAccess.fromProject()] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse("Project details", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const reorderProjectsRoute = createRoute({
  method: "put",
  operationId: "reorderProjects",
  path: "/reorder",
  tags: ["Projects"],
  summary: "Reorder projects",
  description:
    "Set the sidebar order of a workspace's projects. The given positions express relative order only -- the workspace is renumbered to 0..n-1.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    query: workspaceIdQuery,
    body: {
      required: true,
      content: { "application/json": { schema: reorderProjectsBody } },
    },
  },
  responses: {
    // Reorder returns the plain project rows, without the list route's
    // rollup statistics.
    200: jsonResponse("The reordered projects", z.array(projectSchema)),
    400: errorResponse("Invalid body, or workspace ID could not be determined"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateProjectRoute = createRoute({
  method: "put",
  operationId: "updateProject",
  path: "/{id}",
  tags: ["Projects"],
  summary: "Update project",
  description:
    "Replace a project's name, icon, slug, description, and visibility.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateProjectBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated project", projectSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteProjectRoute = createRoute({
  method: "delete",
  operationId: "deleteProject",
  path: "/{id}",
  tags: ["Projects"],
  summary: "Delete project",
  description:
    "Permanently delete a project and everything in it. Archive it instead to keep the data.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["delete"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse("The deleted project", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:delete permission",
    ),
  },
});

const archiveProjectRoute = createRoute({
  method: "put",
  operationId: "archiveProject",
  path: "/{id}/archive",
  tags: ["Projects"],
  summary: "Archive project",
  description:
    "Hide a project from the default list without deleting it. Reversible with unarchive.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse("The archived project", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const unarchiveProjectRoute = createRoute({
  method: "put",
  operationId: "unarchiveProject",
  path: "/{id}/unarchive",
  tags: ["Projects"],
  summary: "Unarchive project",
  description: "Return an archived project to the default list.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    200: jsonResponse("The restored project", projectSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const getProjectBackgroundRoute = createRoute({
  method: "get",
  operationId: "getProjectBackground",
  path: "/{id}/background",
  tags: ["Projects"],
  summary: "Download project background",
  description: "Download the current project board background image.",
  middleware: [workspaceAccess.fromProject()] as const,
  request: { params: projectParam },
  responses: {
    200: {
      description: "The project background image",
      content: {
        "image/*": { schema: { type: "string", format: "binary" } },
      },
    },
    304: { description: "Not modified" },
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
    404: errorResponse("Project background not found"),
  },
});

const uploadProjectBackgroundRoute = createRoute({
  method: "put",
  operationId: "uploadProjectBackground",
  path: "/{id}/background-upload",
  tags: ["Projects"],
  summary: "Prepare project background upload",
  description: "Create a presigned background image upload URL for a project.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    requireEntitlement,
  ] as const,
  request: {
    params: projectParam,
    body: {
      required: true,
      content: {
        "application/json": { schema: uploadProjectBackgroundBody },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Background image upload URL",
      projectBackgroundUploadSchema,
    ),
    400: errorResponse("Invalid image upload request, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Project not found"),
    503: errorResponse("Image uploads are not configured"),
  },
});

const finalizeProjectBackgroundRoute = createRoute({
  method: "post",
  operationId: "finalizeProjectBackgroundUpload",
  path: "/{id}/background-upload/finalize",
  tags: ["Projects"],
  summary: "Finalize project background upload",
  description: "Save an uploaded image as the project's board background.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
    requireEntitlement,
  ] as const,
  request: {
    params: projectParam,
    body: {
      required: true,
      content: {
        "application/json": { schema: finalizeProjectBackgroundBody },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Finalized project background",
      projectBackgroundFinalizeSchema,
    ),
    400: errorResponse("Invalid image upload request, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    404: errorResponse("Project not found"),
    500: errorResponse("Failed to save the project background"),
  },
});

const deleteProjectBackgroundRoute = createRoute({
  method: "delete",
  operationId: "deleteProjectBackground",
  path: "/{id}/background",
  tags: ["Projects"],
  summary: "Delete project background",
  description: "Remove the current project board background image.",
  middleware: [
    workspaceAccess.fromProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectParam },
  responses: {
    204: { description: "Project background removed" },
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const project = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listProjectsRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { includeArchived } = c.req.valid("query");
    const projects = await getProjectsCtrl(
      workspaceId,
      includeArchived === "true",
    );
    return c.json(projects, 200);
  })
  .openapi(createProjectRoute, async (c) => {
    const { name, icon, slug } = c.req.valid("json");
    const workspaceId = c.get("workspaceId");
    const newProject = await createProjectCtrl(workspaceId, name, icon, slug);
    return c.json(newProject, 200);
  })
  .openapi(getProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const projectData = await getProjectCtrl(id, workspaceId);
    return c.json(projectData, 200);
  })
  .openapi(getProjectBackgroundRoute, async (c) => {
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
        await (object.body as ReadableStream).cancel();
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
        await (object.body as ReadableStream).cancel();
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
  })
  .openapi(reorderProjectsRoute, async (c) => {
    const workspaceId = c.get("workspaceId");
    const { projects } = c.req.valid("json");
    const reordered = await reorderProjectsCtrl(workspaceId, projects);
    return c.json(reordered, 200);
  })
  .openapi(updateProjectRoute, async (c) => {
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
    return c.json(updatedProject, 200);
  })
  .openapi(deleteProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const deletedProject = await deleteProjectCtrl(id, workspaceId);
    return c.json(deletedProject, 200);
  })
  .openapi(archiveProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const archivedProject = await archiveProjectCtrl(id, workspaceId);
    return c.json(archivedProject, 200);
  })
  .openapi(unarchiveProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const workspaceId = c.get("workspaceId");
    const unarchivedProject = await unarchiveProjectCtrl(id, workspaceId);
    return c.json(unarchivedProject, 200);
  })
  .openapi(uploadProjectBackgroundRoute, async (c) => {
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
      return c.json(upload, 200);
    } catch (error) {
      throw new HTTPException(503, {
        message:
          error instanceof Error
            ? error.message
            : "Image uploads are not configured",
      });
    }
  })
  .openapi(finalizeProjectBackgroundRoute, async (c) => {
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
        message: "Image upload key does not match the project context.",
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
      deleteS3Object(currentProject.backgroundObjectKey).catch((error) => {
        console.warn(`S3 cleanup error: ${error}`);
      });
    }

    const apiBaseUrl = normalizeApiServerUrl(
      process.env.KANEO_API_URL || new URL(c.req.url).origin,
    );
    return c.json(
      {
        url: `${apiBaseUrl}/project/${updatedProject.id}/background?v=${encodeURIComponent(version)}`,
      },
      200,
    );
  })
  .openapi(deleteProjectBackgroundRoute, async (c) => {
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
  });

export default project;
