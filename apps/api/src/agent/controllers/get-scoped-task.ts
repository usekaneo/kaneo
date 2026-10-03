import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AgentDatabase } from "../access";
import type { AgentSubject } from "../types";

export async function getScopedTask(
  subject: AgentSubject,
  taskId: string,
  database: AgentDatabase = db,
) {
  const [task] = await database
    .select({ task: schema.taskTable })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.taskTable.projectId, schema.projectTable.id),
    )
    .where(
      and(
        eq(schema.taskTable.id, taskId),
        eq(schema.projectTable.workspaceId, subject.workspaceId),
        subject.projectId
          ? eq(schema.taskTable.projectId, subject.projectId)
          : undefined,
      ),
    )
    .limit(1);
  if (!task)
    throw new HTTPException(404, { message: "Task not found in agent scope" });
  return task.task;
}
