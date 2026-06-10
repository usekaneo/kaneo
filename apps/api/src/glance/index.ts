import { createId } from "@paralleldrive/cuid2";
import {
  and,
  asc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db, { schema } from "../database";

const {
  taskTable,
  projectTable,
  workspaceTable,
  workspaceUserTable,
  columnTable,
  labelTable,
  userTable,
  glanceUserPrefsTable,
} = schema;

const glance = new Hono<{ Variables: { userId: string } }>();

// ─── GET /tasks ──────────────────────────────────────────────────────────────
// Non-final tasks assigned to the requested users, with optional filters.
// Query params (all optional):
//   workspaceId, project, priority, status, label, due=(overdue|today|week|none)
//   assignees=comma-separated userIds or "me" (default: "me")

const glanceTaskSchema = v.object({
  taskId: v.string(),
  title: v.string(),
  status: v.string(),
  priority: v.nullable(v.string()),
  dueDate: v.nullable(v.string()),
  number: v.number(),
  projectId: v.string(),
  projectName: v.string(),
  workspaceId: v.string(),
  workspaceName: v.string(),
  workspaceSlug: v.string(),
  columnName: v.nullable(v.string()),
  assigneeId: v.string(),
  assigneeName: v.string(),
  assigneeImage: v.nullable(v.string()),
  labels: v.array(v.object({ name: v.string(), color: v.string() })),
});

glance.get(
  "/tasks",
  describeRoute({
    operationId: "getGlanceTasks",
    tags: ["Glance"],
    description:
      "Active tasks assigned to the requested users, filtered to workspaces the caller can access",
    responses: {
      200: {
        description: "Task list",
        content: {
          "application/json": {
            schema: resolver(v.object({ tasks: v.array(glanceTaskSchema) })),
          },
        },
      },
    },
  }),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    // Resolve assignees: "me" → current userId; default when absent = [userId]
    const assigneesRaw = c.req.queries("assignees") ?? [];
    const resolvedAssignees = assigneesRaw.length
      ? assigneesRaw
          .map((id) => (id.trim() === "me" ? userId : id.trim()))
          .filter(Boolean)
      : [userId];

    const wsFilter = c.req.queries("workspaceId") ?? [];
    const projFilter = c.req.queries("project") ?? [];
    const priFilter = c.req.queries("priority") ?? [];
    const statusFilter = c.req.queries("status") ?? [];
    const labelFilter = c.req.queries("label") ?? [];
    const dueFilter = c.req.query("due") ?? null;

    const conditions = [
      inArray(taskTable.userId, resolvedAssignees),
      or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
      // Security: caller must be a member of the workspace
      eq(workspaceUserTable.userId, userId),
    ];

    if (wsFilter.length) conditions.push(inArray(workspaceTable.id, wsFilter));
    if (projFilter.length)
      conditions.push(inArray(projectTable.id, projFilter));
    if (priFilter.length)
      conditions.push(inArray(taskTable.priority, priFilter));
    if (statusFilter.length)
      conditions.push(inArray(taskTable.status, statusFilter));
    if (labelFilter.length) {
      conditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(labelTable)
            .where(
              and(
                eq(labelTable.taskId, taskTable.id),
                inArray(labelTable.name, labelFilter),
              ),
            ),
        ),
      );
    }
    if (dueFilter === "overdue") {
      conditions.push(
        and(isNotNull(taskTable.dueDate), lt(taskTable.dueDate, sql`now()`)),
      );
    } else if (dueFilter === "today") {
      conditions.push(sql`${taskTable.dueDate}::date = current_date`);
    } else if (dueFilter === "week") {
      conditions.push(
        and(
          isNotNull(taskTable.dueDate),
          gte(taskTable.dueDate, sql`now()`),
          lt(taskTable.dueDate, sql`now() + interval '7 days'`),
        ),
      );
    } else if (dueFilter === "none") {
      conditions.push(isNull(taskTable.dueDate));
    }

    const tasks = await db
      .select({
        taskId: taskTable.id,
        title: taskTable.title,
        status: taskTable.status,
        priority: taskTable.priority,
        dueDate: sql<string | null>`${taskTable.dueDate}::text`,
        number: taskTable.number,
        projectId: projectTable.id,
        projectName: projectTable.name,
        workspaceId: workspaceTable.id,
        workspaceName: workspaceTable.name,
        workspaceSlug: workspaceTable.slug,
        columnName: columnTable.name,
        assigneeId: userTable.id,
        assigneeName: userTable.name,
        assigneeImage: userTable.image,
        labels: sql<Array<{ name: string; color: string }>>`COALESCE(
          (SELECT json_agg(json_build_object('name', l.name, 'color', l.color))
           FROM ${labelTable} l WHERE l.task_id = ${taskTable.id}),
          '[]'::json
        )`,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .innerJoin(
        workspaceTable,
        eq(projectTable.workspaceId, workspaceTable.id),
      )
      .innerJoin(
        workspaceUserTable,
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
      )
      .innerJoin(userTable, eq(userTable.id, taskTable.userId))
      .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${taskTable.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`,
        asc(taskTable.dueDate),
        asc(workspaceTable.name),
        asc(projectTable.name),
      );

    return c.json({ tasks });
  },
);

// ─── GET /members ─────────────────────────────────────────────────────────────
// All users who share at least one workspace with the current user.

glance.get(
  "/members",
  describeRoute({
    operationId: "getGlanceMembers",
    tags: ["Glance"],
    description: "All workspace members accessible to the current user",
    responses: {
      200: {
        description: "Member list",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                members: v.array(
                  v.object({
                    id: v.string(),
                    name: v.string(),
                    image: v.nullable(v.string()),
                  }),
                ),
              }),
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    // Subquery: workspaces the caller belongs to
    const myWorkspaces = db
      .select({ workspaceId: workspaceUserTable.workspaceId })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.userId, userId));

    const members = await db
      .selectDistinct({
        id: userTable.id,
        name: userTable.name,
        image: userTable.image,
      })
      .from(userTable)
      .innerJoin(
        workspaceUserTable,
        eq(workspaceUserTable.userId, userTable.id),
      )
      .where(inArray(workspaceUserTable.workspaceId, myWorkspaces))
      .orderBy(asc(userTable.name));

    return c.json({ members });
  },
);

// ─── GET /filters ─────────────────────────────────────────────────────────────

glance.get(
  "/filters",
  describeRoute({
    operationId: "getGlanceFilters",
    tags: ["Glance"],
    description: "Filter options available to the current user",
    responses: {
      200: {
        description: "Filter options",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                workspaces: v.array(
                  v.object({
                    id: v.string(),
                    name: v.string(),
                    slug: v.string(),
                  }),
                ),
                projects: v.array(
                  v.object({
                    id: v.string(),
                    name: v.string(),
                    workspaceId: v.string(),
                  }),
                ),
                labels: v.array(
                  v.object({ name: v.string(), color: v.string() }),
                ),
                priorities: v.array(v.string()),
              }),
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    const [workspaces, projects, labels] = await Promise.all([
      db
        .selectDistinct({
          id: workspaceTable.id,
          name: workspaceTable.name,
          slug: workspaceTable.slug,
        })
        .from(workspaceTable)
        .innerJoin(
          workspaceUserTable,
          and(
            eq(workspaceUserTable.workspaceId, workspaceTable.id),
            eq(workspaceUserTable.userId, userId),
          ),
        )
        .orderBy(asc(workspaceTable.name)),

      db
        .selectDistinct({
          id: projectTable.id,
          name: projectTable.name,
          workspaceId: projectTable.workspaceId,
        })
        .from(projectTable)
        .innerJoin(
          workspaceUserTable,
          and(
            eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
            eq(workspaceUserTable.userId, userId),
          ),
        )
        .where(isNull(projectTable.archivedAt))
        .orderBy(asc(projectTable.name)),

      db
        .selectDistinct({
          name: labelTable.name,
          color: labelTable.color,
        })
        .from(labelTable)
        .innerJoin(
          workspaceUserTable,
          and(
            eq(workspaceUserTable.workspaceId, labelTable.workspaceId),
            eq(workspaceUserTable.userId, userId),
          ),
        )
        .orderBy(asc(labelTable.name)),
    ]);

    return c.json({
      workspaces,
      projects,
      labels,
      priorities: ["urgent", "high", "medium", "low"],
    });
  },
);

// ─── GET /prefs ───────────────────────────────────────────────────────────────

const savedViewSchema = v.object({
  id: v.string(),
  name: v.string(),
  filters: v.record(v.string(), v.string()),
  groupBy: v.string(),
});

const prefsSchema = v.object({
  filters: v.record(v.string(), v.string()),
  groupBy: v.string(),
  views: v.array(savedViewSchema),
});

glance.get(
  "/prefs",
  describeRoute({
    operationId: "getGlancePrefs",
    tags: ["Glance"],
    description: "Current user's Glance filter preferences",
    responses: {
      200: {
        description: "Preferences",
        content: {
          "application/json": { schema: resolver(prefsSchema) },
        },
      },
    },
  }),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    const [row] = await db
      .select({
        filters: glanceUserPrefsTable.filters,
        groupBy: glanceUserPrefsTable.groupBy,
        views: glanceUserPrefsTable.views,
      })
      .from(glanceUserPrefsTable)
      .where(eq(glanceUserPrefsTable.userId, userId))
      .limit(1);

    return c.json(row ?? { filters: {}, groupBy: "workspace", views: [] });
  },
);

// ─── PUT /prefs ───────────────────────────────────────────────────────────────

const VALID_GROUP_BY = [
  "workspace",
  "project",
  "priority",
  "due",
  "none",
] as const;

glance.put(
  "/prefs",
  describeRoute({
    operationId: "updateGlancePrefs",
    tags: ["Glance"],
    description: "Save current user's Glance filter preferences",
    responses: {
      200: {
        description: "Saved preferences",
        content: {
          "application/json": { schema: resolver(prefsSchema) },
        },
      },
    },
  }),
  validator(
    "json",
    v.object({
      filters: v.optional(v.record(v.string(), v.string())),
      groupBy: v.optional(v.picklist(VALID_GROUP_BY)),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    const body = c.req.valid("json");

    const [existing] = await db
      .select({
        filters: glanceUserPrefsTable.filters,
        groupBy: glanceUserPrefsTable.groupBy,
        views: glanceUserPrefsTable.views,
      })
      .from(glanceUserPrefsTable)
      .where(eq(glanceUserPrefsTable.userId, userId))
      .limit(1);

    const nextFilters = body.filters ?? existing?.filters ?? {};
    const nextGroupBy = body.groupBy ?? existing?.groupBy ?? "workspace";
    const nextViews = existing?.views ?? [];

    await db
      .insert(glanceUserPrefsTable)
      .values({
        userId,
        filters: nextFilters,
        groupBy: nextGroupBy,
        views: nextViews,
      })
      .onConflictDoUpdate({
        target: glanceUserPrefsTable.userId,
        set: { filters: nextFilters, groupBy: nextGroupBy },
      });

    return c.json({
      filters: nextFilters,
      groupBy: nextGroupBy,
      views: nextViews,
    });
  },
);

// ─── POST /views ─────────────────────────────────────────────────────────────

glance.post(
  "/views",
  describeRoute({
    operationId: "createGlanceView",
    tags: ["Glance"],
    description: "Save a named view from the current filter state",
    responses: {
      200: {
        description: "Updated preferences with new view",
        content: {
          "application/json": { schema: resolver(prefsSchema) },
        },
      },
    },
  }),
  validator(
    "json",
    v.object({
      name: v.pipe(v.string(), v.minLength(1)),
      filters: v.record(v.string(), v.string()),
      groupBy: v.picklist(VALID_GROUP_BY),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    const body = c.req.valid("json");
    const [existing] = await db
      .select({
        filters: glanceUserPrefsTable.filters,
        groupBy: glanceUserPrefsTable.groupBy,
        views: glanceUserPrefsTable.views,
      })
      .from(glanceUserPrefsTable)
      .where(eq(glanceUserPrefsTable.userId, userId))
      .limit(1);

    const newView = {
      id: createId(),
      name: body.name,
      filters: body.filters,
      groupBy: body.groupBy,
    };
    const nextViews = [...(existing?.views ?? []), newView];
    const currentFilters = existing?.filters ?? {};
    const currentGroupBy = existing?.groupBy ?? "workspace";

    await db
      .insert(glanceUserPrefsTable)
      .values({
        userId,
        filters: currentFilters,
        groupBy: currentGroupBy,
        views: nextViews,
      })
      .onConflictDoUpdate({
        target: glanceUserPrefsTable.userId,
        set: { views: nextViews },
      });

    return c.json({
      filters: currentFilters,
      groupBy: currentGroupBy,
      views: nextViews,
    });
  },
);

// ─── DELETE /views/:viewId ────────────────────────────────────────────────────

glance.delete(
  "/views/:viewId",
  describeRoute({
    operationId: "deleteGlanceView",
    tags: ["Glance"],
    description: "Delete a saved view by ID",
    responses: {
      200: {
        description: "Updated preferences after deletion",
        content: {
          "application/json": { schema: resolver(prefsSchema) },
        },
      },
    },
  }),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

    const viewId = c.req.param("viewId");

    const [existing] = await db
      .select({
        filters: glanceUserPrefsTable.filters,
        groupBy: glanceUserPrefsTable.groupBy,
        views: glanceUserPrefsTable.views,
      })
      .from(glanceUserPrefsTable)
      .where(eq(glanceUserPrefsTable.userId, userId))
      .limit(1);

    if (!existing)
      return c.json({ filters: {}, groupBy: "workspace", views: [] });

    const nextViews = (existing.views ?? []).filter(
      (view) => view.id !== viewId,
    );

    await db
      .update(glanceUserPrefsTable)
      .set({ views: nextViews })
      .where(eq(glanceUserPrefsTable.userId, userId));

    return c.json({
      filters: existing.filters,
      groupBy: existing.groupBy,
      views: nextViews,
    });
  },
);

export default glance;
