import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { requireEntitlement } from "../../billing/require-entitlement-middleware";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";

type TaskEnv = {
  Variables: {
    userId: string;
  };
};

type BulkTaskOperation =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

type BulkTaskContext = Context<
  TaskEnv,
  string,
  { out: { json: { operation: BulkTaskOperation } } }
>;

type TaskAssigneeContext = Context<
  TaskEnv,
  string,
  {
    out: {
      param: { id: string };
      json: { userId?: string };
    };
  }
>;

export async function requireBulkTaskPermission(
  c: BulkTaskContext,
  next: Next,
) {
  const { operation } = c.req.valid("json");

  if (operation === "delete") {
    return requireWorkspacePermission({ task: ["delete"] })(c, next);
  }

  if (operation === "updateAssignee") {
    return requireWorkspacePermission({ task: ["assign"] })(c, next);
  }

  if (operation === "addLabel" || operation === "removeLabel") {
    return requireWorkspacePermission({ label: ["update"] })(c, next);
  }

  return requireWorkspacePermission({ task: ["update"] })(c, next);
}

export async function requireBulkTaskEntitlement(
  c: BulkTaskContext,
  next: Next,
) {
  const { operation } = c.req.valid("json");

  if (
    operation === "delete" ||
    operation === "addLabel" ||
    operation === "removeLabel"
  ) {
    return next();
  }

  return requireEntitlement(c, next);
}

export async function requireTaskAssigneePermission(
  c: TaskAssigneeContext,
  next: Next,
) {
  const { id } = c.req.valid("param");
  const { userId } = c.req.valid("json");
  const [existingTask] = await db
    .select({ userId: taskTable.userId })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (existingTask && existingTask.userId !== (userId || null)) {
    return requireWorkspacePermission({ task: ["assign"] })(c, next);
  }

  return next();
}
