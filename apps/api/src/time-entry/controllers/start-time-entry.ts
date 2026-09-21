import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  taskTable,
  timeEntryTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

// A retried start (double-click, timeout retry) returns the entry the first
// attempt created instead of churning the previous timer.
const RETRY_WINDOW_SECONDS = 15;

// An auto-stopped entry younger than this never represented real work, so it
// is discarded silently instead of leaving a junk row and activity behind.
const MIN_KEPT_SECONDS = 3;

import { MAX_DURATION_SECONDS } from "../duration";

type StartTimeEntryParams = {
  taskId: string;
  userId: string;
  description?: string;
  billable?: boolean;
};

async function startTimeEntry(params: StartTimeEntryParams) {
  const { taskId, userId, description, billable } = params;

  const result = await db.transaction(async (tx) => {
    // Serialize starts per user. NOW() is transaction-stable in Postgres, so
    // the auto-stop and the insert below share one timestamp by construction.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`,
    );

    const [running] = await tx
      .select({
        entry: timeEntryTable,
        ageSeconds:
          sql<number>`EXTRACT(EPOCH FROM (NOW() - ${timeEntryTable.startTime}))`.as(
            "age_seconds",
          ),
        createdSecondsAgo:
          sql<number>`EXTRACT(EPOCH FROM (NOW() - ${timeEntryTable.createdAt}))`.as(
            "created_seconds_ago",
          ),
      })
      .from(timeEntryTable)
      .where(
        and(eq(timeEntryTable.userId, userId), isNull(timeEntryTable.endTime)),
      )
      .limit(1);

    // Same task within the retry window: the first attempt already created
    // this entry, so hand it back instead of stopping and recreating it.
    if (
      running &&
      running.entry.taskId === taskId &&
      running.createdSecondsAgo < RETRY_WINDOW_SECONDS
    ) {
      return {
        entry: running.entry,
        stopped: null,
        stoppedTaskId: null as string | null,
        discardedEntryId: null as string | null,
        discardedTaskId: null as string | null,
      };
    }

    let stopped: typeof timeEntryTable.$inferSelect | null = null;
    let discardedEntryId: string | null = null;
    let discardedTaskId: string | null = null;

    if (running) {
      if (running.ageSeconds < MIN_KEPT_SECONDS) {
        await tx
          .delete(timeEntryTable)
          .where(eq(timeEntryTable.id, running.entry.id));
        discardedEntryId = running.entry.id;
        discardedTaskId = running.entry.taskId;
      } else {
        const [closed] = await tx
          .update(timeEntryTable)
          .set({
            endTime: sql`NOW()`,
            duration: sql<number>`LEAST(${MAX_DURATION_SECONDS}, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ${timeEntryTable.startTime})))))`,
          })
          .where(eq(timeEntryTable.id, running.entry.id))
          .returning();

        if (!closed) {
          throw new HTTPException(500, {
            message: "Failed to start time tracking",
          });
        }

        // Same transaction as the close: a concurrent delete or edit sees
        // both rows or neither, so no ghost feed row can ever land.
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

        stopped = closed;
      }
    }

    let entry: typeof timeEntryTable.$inferSelect | undefined;
    try {
      [entry] = await tx
        .insert(timeEntryTable)
        .values({
          id: createId(),
          taskId,
          userId,
          description: description || "",
          billable: billable ?? true,
          startTime: sql`NOW()`,
          endTime: null,
          duration: null,
        })
        .returning();
    } catch (error) {
      // The partial unique index is the backstop for the advisory lock.
      // Surface a retryable conflict instead of a raw constraint error.
      // Drizzle surfaces driver failures as DrizzleQueryError with the pg
      // error on `cause`.
      const cause =
        typeof error === "object" && error !== null && "cause" in error
          ? (error as { cause?: unknown }).cause
          : error;
      if (
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        (cause as { code?: unknown }).code === "23505"
      ) {
        throw new HTTPException(409, {
          message: "A timer is already running. Please try again.",
        });
      }
      throw error;
    }

    if (!entry) {
      throw new HTTPException(500, {
        message: "Failed to start time tracking",
      });
    }

    return {
      entry,
      stopped,
      stoppedTaskId: stopped?.taskId ?? null,
      discardedEntryId,
      discardedTaskId,
    };
  });

  // The started entry itself is realtime-only: no activity row, no
  // notification, just fan-out so other tabs and viewers invalidate.
  const [startedTask] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (result.discardedEntryId && result.discardedTaskId) {
    const [discardedTask] = await db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, result.discardedTaskId))
      .limit(1);

    await publishEvent("time-entry.deleted", {
      timeEntryId: result.discardedEntryId,
      taskId: result.discardedTaskId,
      userId,
      type: "delete",
      projectId: discardedTask?.projectId,
    });
  }

  await publishEvent("time-entry.started", {
    timeEntryId: result.entry.id,
    taskId,
    userId,
    type: "start",
    projectId: startedTask?.projectId,
  });

  // Announced after commit: only a kept auto-stop is a completed entry.
  // Its activity row already committed inside the transaction above.
  if (result.stopped) {
    const [task] = await db
      .select({
        userId: taskTable.userId,
        title: taskTable.title,
        projectId: taskTable.projectId,
      })
      .from(taskTable)
      .where(eq(taskTable.id, result.stopped.taskId))
      .limit(1);

    await publishEvent("time-entry.created", {
      timeEntryId: result.stopped.id,
      taskId: result.stopped.taskId,
      userId,
      type: "create",
      content: "tracked time",
      taskOwnerId: task?.userId,
      taskTitle: task?.title,
      projectId: task?.projectId,
      duration: result.stopped.duration,
      billable: result.stopped.billable,
    });
  }

  return {
    entry: result.entry,
    stoppedEntryId: result.stopped?.id ?? null,
    stoppedTaskId: result.stoppedTaskId,
    discardedEntryId: result.discardedEntryId,
    discardedTaskId: result.discardedTaskId,
  };
}

export default startTimeEntry;
