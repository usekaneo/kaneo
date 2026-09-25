import { and, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  taskTable,
  timeEntryTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { MAX_DURATION_SECONDS } from "../duration";

type StopTimeEntryParams = {
  taskId: string;
  userId: string;
};

async function stopTimeEntry(params: StopTimeEntryParams) {
  const { taskId, userId } = params;

  // Entry close and activity row commit atomically: concurrent deletes or
  // edits either see both or neither, so no ghost or stale feed row can ever
  // land regardless of request overlap. NOW() is transaction-stable, so the
  // stamped end and the derived duration share one timestamp by construction.
  const [stopped] = await db.transaction(async (tx) => {
    // Start and stop both change this user's one global running timer.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`time_tracking:${userId}`})::bigint)`,
    );

    const [closed] = await tx
      .update(timeEntryTable)
      .set({
        endTime: sql`NOW()`,
        duration: sql<number>`LEAST(${MAX_DURATION_SECONDS}, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ${timeEntryTable.startTime})))))`,
      })
      .where(
        and(
          eq(timeEntryTable.taskId, taskId),
          eq(timeEntryTable.userId, userId),
          isNull(timeEntryTable.endTime),
        ),
      )
      .returning();

    if (closed) {
      await tx.insert(activityTable).values({
        taskId: closed.taskId,
        type: "time_tracked",
        userId,
        content: null,
        eventData: {
          timeEntryId: closed.id,
          duration: closed.duration,
          billable: closed.billable,
        },
      });
    }

    return [closed];
  });

  if (stopped) {
    const [task] = await db
      .select({
        userId: taskTable.userId,
        title: taskTable.title,
        projectId: taskTable.projectId,
      })
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .limit(1);

    await publishEvent("time-entry.created", {
      timeEntryId: stopped.id,
      taskId: stopped.taskId,
      userId,
      type: "create",
      content: "tracked time",
      taskOwnerId: task?.userId,
      taskTitle: task?.title,
      projectId: task?.projectId,
      duration: stopped.duration,
      billable: stopped.billable,
    });

    return stopped;
  }

  // Nothing running: say so plainly. Repeats are already absorbed by the
  // disabled-while-pending buttons, and a retry that lands here only means
  // the first stop committed, which the next fetch will show.
  throw new HTTPException(404, {
    message: "No running timer found for this task",
  });
}

export default stopTimeEntry;
