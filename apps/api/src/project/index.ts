import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireEntitlement } from "../billing/require-entitlement-middleware";
import { projectSchema } from "../schemas";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import archiveProjectCtrl from "./controllers/archive-project";
import createProjectCtrl from "./controllers/create-project";
import deleteProjectCtrl from "./controllers/delete-project";
import getProjectCtrl from "./controllers/get-project";
import getProjectMetricsCtrl from "./controllers/get-project-metrics";
import getProjectsCtrl from "./controllers/get-projects";
import unarchiveProjectCtrl from "./controllers/unarchive-project";
import updateProjectCtrl from "./controllers/update-project";

const projectMetricsSchema = v.object({
  projectId: v.string(),
  projectName: v.string(),
  summary: v.object({
    totalTasks: v.number(),
    completedTasks: v.number(),
    inProgressTasks: v.number(),
    unassignedTasks: v.number(),
    overdueTasks: v.number(),
    completionPercentage: v.number(),
  }),
  columns: v.array(
    v.object({
      id: v.nullable(v.string()),
      name: v.string(),
      slug: v.string(),
      color: v.nullable(v.string()),
      position: v.number(),
      isFinal: v.boolean(),
      count: v.number(),
    }),
  ),
  assignees: v.array(
    v.object({
      userId: v.nullable(v.string()),
      name: v.string(),
      email: v.nullable(v.string()),
      image: v.nullable(v.string()),
      assigned: v.number(),
      done: v.number(),
      inProgress: v.number(),
    }),
  ),
  contracts: v.object({
    total: v.number(),
    byStatus: v.array(
      v.object({
        status: v.string(),
        count: v.number(),
      }),
    ),
  }),
  priority: v.array(
    v.object({
      priority: v.string(),
      count: v.number(),
    }),
  ),
  activity: v.array(
    v.object({
      date: v.string(),
      created: v.number(),
      completed: v.number(),
    }),
  ),
});

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
    "/:id/metrics",
    describeRoute({
      operationId: "getProjectMetrics",
      tags: ["Projects"],
      description:
        "Aggregated project metrics: columns, assignees, contracts, priority and activity",
      responses: {
        200: {
          description: "Project metrics",
          content: {
            "application/json": { schema: resolver(projectMetricsSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromProject(),
    async (c) => {
      const { id } = c.req.valid("param");
      const workspaceId = c.get("workspaceId");
      const metrics = await getProjectMetricsCtrl(id, workspaceId);
      return c.json(metrics);
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
  );

export default project;
