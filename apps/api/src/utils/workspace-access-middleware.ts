import { and, eq, inArray } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { validateWorkspaceAccess } from "./validate-workspace-access";

type LookupResource =
  | "project"
  | "task"
  | "label"
  | "timeEntry"
  | "activity"
  | "comment"
  | "column"
  | "workflowRule"
  | "customField";

type WorkspaceIdSource =
  | { type: "query"; key: string }
  | { type: "body"; key: string }
  | { type: "param"; key: string }
  | {
      type: "lookup";
      resource: LookupResource;
      idKey: string;
    }
  | {
      type: "lookupMany";
      resource: "task";
      idKey: string;
    };

const WORKSPACE_NOT_FOUND = "Workspace not found";
const TASKS_NOT_FOUND = "No tasks found";

const RESOURCE_NOT_FOUND: Record<LookupResource, string> = {
  project: "Project not found",
  task: "Task not found",
  label: "Label not found",
  timeEntry: "Time entry not found",
  activity: "Activity not found",
  comment: "Comment not found",
  column: "Column not found",
  workflowRule: "Workflow rule not found",
  customField: "Custom field not found",
};

type WorkspaceAccessMiddlewareConfig = {
  sources: WorkspaceIdSource[];
};

type ResourceScope = { workspaceId: string; projectId: string | null };

async function readJsonObjectBody(
  c: Context,
): Promise<Record<string, unknown>> {
  const raw = (await c.req.json().catch(() => ({}))) || {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

export function workspaceAccessMiddleware(
  config: WorkspaceAccessMiddlewareConfig,
) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");

    if (!userId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    let workspaceId: string | null = null;
    let projectIds: string[] = [];
    let notFoundMessage = WORKSPACE_NOT_FOUND;

    for (const source of config.sources) {
      if (source.type === "query") {
        workspaceId = c.req.query(source.key) || null;
      } else if (source.type === "body") {
        const body = await readJsonObjectBody(c);
        const bodyValue = body[source.key];
        workspaceId = typeof bodyValue === "string" ? bodyValue : null;
      } else if (source.type === "param") {
        workspaceId = c.req.param(source.key) || null;
      } else if (source.type === "lookup") {
        const body = await readJsonObjectBody(c);
        const bodyId = body[source.idKey];
        const idFromBody = typeof bodyId === "string" ? bodyId : null;
        // Only accept the id from the same place the handler will read it
        // (path param or JSON body). Accepting it from the query string let a
        // caller authorize against one resource (`?taskId=<mine>`) while the
        // handler acted on another (`{"taskId": "<someone else's>"}`).
        const id = c.req.param(source.idKey) || idFromBody;
        if (id) {
          notFoundMessage = RESOURCE_NOT_FOUND[source.resource];
          const scope = await lookupScope(source.resource, id);
          if (!scope) {
            throw new HTTPException(404, { message: notFoundMessage });
          }
          workspaceId = scope.workspaceId;
          projectIds = scope.projectId ? [scope.projectId] : [];
        }
      } else if (source.type === "lookupMany") {
        const body = await readJsonObjectBody(c);
        const ids = body[source.idKey];
        if (Array.isArray(ids)) {
          const taskIds = ids.filter(
            (id): id is string => typeof id === "string",
          );
          if (taskIds.length > 0) {
            notFoundMessage = TASKS_NOT_FOUND;
            const tasks = await db
              .select({
                workspaceId: schema.projectTable.workspaceId,
                projectId: schema.projectTable.id,
              })
              .from(schema.taskTable)
              .innerJoin(
                schema.projectTable,
                eq(schema.taskTable.projectId, schema.projectTable.id),
              )
              .where(inArray(schema.taskTable.id, taskIds));
            const workspaceIds = [
              ...new Set(tasks.map((task) => task.workspaceId)),
            ];
            if (workspaceIds.length === 0) {
              throw new HTTPException(404, { message: notFoundMessage });
            }
            if (workspaceIds.length > 1) {
              throw new HTTPException(400, {
                message: "All tasks must belong to the same workspace",
              });
            }
            workspaceId = workspaceIds[0] ?? null;
            projectIds = [...new Set(tasks.map((task) => task.projectId))];
          }
        }
      }

      if (workspaceId) {
        break;
      }
    }

    if (!workspaceId) {
      throw new HTTPException(400, {
        message: "Workspace ID could not be determined",
      });
    }

    const apiKey = c.get("apiKey");
    const apiKeyId = apiKey?.id;

    await validateWorkspaceAccess(userId, workspaceId, apiKeyId, {
      notFoundMessage,
    });
    await assertProjectAccess(userId, projectIds);

    c.set("workspaceId", workspaceId);

    return next();
  };
}

async function lookupScope(
  resource: LookupResource,
  id: string,
): Promise<ResourceScope | null> {
  switch (resource) {
    case "project": {
      const [project] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.projectTable)
        .where(eq(schema.projectTable.id, id))
        .limit(1);
      return project ?? null;
    }

    case "task": {
      const [task] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.taskTable)
        .innerJoin(
          schema.projectTable,
          eq(schema.taskTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.taskTable.id, id))
        .limit(1);
      return task ?? null;
    }

    case "label": {
      const [label] = await db
        .select({
          workspaceId: schema.labelTable.workspaceId,
          taskId: schema.labelTable.taskId,
          taskWorkspaceId: schema.projectTable.workspaceId,
          taskProjectId: schema.projectTable.id,
        })
        .from(schema.labelTable)
        .leftJoin(
          schema.taskTable,
          eq(schema.labelTable.taskId, schema.taskTable.id),
        )
        .leftJoin(
          schema.projectTable,
          eq(schema.taskTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.labelTable.id, id))
        .limit(1);
      const labelOutsideTaskWorkspace =
        label?.taskId && label.taskWorkspaceId !== label.workspaceId;
      if (labelOutsideTaskWorkspace || !label?.workspaceId) return null;
      return {
        workspaceId: label.workspaceId,
        projectId: label.taskProjectId ?? null,
      };
    }

    case "timeEntry": {
      const [timeEntry] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.timeEntryTable)
        .innerJoin(
          schema.taskTable,
          eq(schema.timeEntryTable.taskId, schema.taskTable.id),
        )
        .innerJoin(
          schema.projectTable,
          eq(schema.taskTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.timeEntryTable.id, id))
        .limit(1);
      return timeEntry ?? null;
    }

    case "activity": {
      const [activity] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.activityTable)
        .innerJoin(
          schema.taskTable,
          eq(schema.activityTable.taskId, schema.taskTable.id),
        )
        .innerJoin(
          schema.projectTable,
          eq(schema.taskTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.activityTable.id, id))
        .limit(1);
      return activity ?? null;
    }

    case "comment": {
      const [comment] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.activityTable)
        .innerJoin(
          schema.taskTable,
          eq(schema.activityTable.taskId, schema.taskTable.id),
        )
        .innerJoin(
          schema.projectTable,
          eq(schema.taskTable.projectId, schema.projectTable.id),
        )
        .where(
          and(
            eq(schema.activityTable.id, id),
            eq(schema.activityTable.type, "comment"),
          ),
        )
        .limit(1);
      return comment ?? null;
    }

    case "column": {
      const [column] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.columnTable)
        .innerJoin(
          schema.projectTable,
          eq(schema.columnTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.columnTable.id, id))
        .limit(1);
      return column ?? null;
    }

    case "workflowRule": {
      const [workflowRule] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.workflowRuleTable)
        .innerJoin(
          schema.projectTable,
          eq(schema.workflowRuleTable.projectId, schema.projectTable.id),
        )
        .where(eq(schema.workflowRuleTable.id, id))
        .limit(1);
      return workflowRule ?? null;
    }

    case "customField": {
      const [field] = await db
        .select({
          workspaceId: schema.projectTable.workspaceId,
          projectId: schema.projectTable.id,
        })
        .from(schema.customFieldDefinitionTable)
        .innerJoin(
          schema.projectTable,
          eq(
            schema.customFieldDefinitionTable.projectId,
            schema.projectTable.id,
          ),
        )
        .where(eq(schema.customFieldDefinitionTable.id, id))
        .limit(1);
      return field ?? null;
    }

    default:
      return null;
  }
}

export const workspaceAccess = {
  fromQuery: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "query", key }] }),

  fromBody: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "body", key }] }),

  fromParam: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "param", key }] }),

  fromProject: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "project", idKey }],
    }),

  fromTask: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "task", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromTaskId: (idKey = "taskId") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "task", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromTasks: (idKey = "taskIds") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookupMany", resource: "task", idKey }],
    }),

  fromLabel: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "label", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromTimeEntry: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "timeEntry", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromActivity: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "activity", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromComment: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "comment", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromColumn: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "column", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromWorkflowRule: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "workflowRule", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromCustomField: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "customField", idKey }],
    }),

  fromProjectId: (idKey = "projectId") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "project", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
};
